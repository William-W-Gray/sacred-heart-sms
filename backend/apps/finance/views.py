from django.db import IntegrityError, transaction
from rest_framework import serializers, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Invoice, Payment, Receipt, FeeType
from apps.users.views import IsAdminUser, IsAdminOrFinanceOfficer, IsFinanceOfficer, scope_to_own_student
from apps.trash.mixins import SoftDeleteViewSetMixin
from apps.audit.mixins import AuditLogMixin
from apps.audit.models import AuditAction
from apps.audit.services import log_action, serialize_instance, diff_snapshots


def _guess_fee_enum(name: str) -> str:
    """Best-effort map a fee-type name to the legacy Invoice.FeeType enum (kept
    for the old filter/UI). The human-readable label lives in `fee_label`."""
    n = (name or "").lower()
    if "tuition" in n:
        return Invoice.FeeType.TUITION
    if "exam" in n:
        return Invoice.FeeType.EXAM
    if "uniform" in n:
        return Invoice.FeeType.UNIFORM
    if any(k in n for k in ("sport", "activity", "graduation", "pta")):
        return Invoice.FeeType.ACTIVITY
    return Invoice.FeeType.OTHER


class FeeTypeSerializer(serializers.ModelSerializer):
    applies_to_display  = serializers.CharField(source="get_applies_to_display", read_only=True)
    academic_year_name  = serializers.SerializerMethodField()
    semester_name       = serializers.SerializerMethodField()
    default_class_name  = serializers.SerializerMethodField()

    class Meta:
        model  = FeeType
        fields = ["id", "name", "description", "default_amount",
                  "applies_to", "applies_to_display",
                  "academic_year", "academic_year_name",
                  "semester", "semester_name",
                  "default_class", "default_class_name",
                  "is_active", "created_by", "created_at"]
        read_only_fields = ["created_by", "created_at"]

    def get_academic_year_name(self, obj) -> str | None:
        return str(obj.academic_year) if obj.academic_year else None

    def get_semester_name(self, obj) -> str | None:
        return str(obj.semester) if obj.semester else None

    def get_default_class_name(self, obj) -> str | None:
        return str(obj.default_class) if obj.default_class else None

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Fee type name is required.")
        return value

    def create(self, validated_data):
        validated_data.setdefault("created_by", self.context["request"].user)
        return super().create(validated_data)


class PaymentSerializer(serializers.ModelSerializer):
    receipt_number = serializers.SerializerMethodField()
    receipt_id     = serializers.SerializerMethodField()

    class Meta:
        model  = Payment
        fields = ["id", "invoice", "amount", "method", "reference_number",
                  "payment_date", "received_by", "is_verified", "notes",
                  "receipt_number", "receipt_id", "created_at"]
        read_only_fields = ["created_at"]

    def get_receipt_number(self, obj) -> str | None:
        receipt = getattr(obj, "receipt", None)
        return receipt.receipt_number if receipt else None

    def get_receipt_id(self, obj) -> int | None:
        receipt = getattr(obj, "receipt", None)
        return receipt.id if receipt else None

    def validate(self, attrs):
        # Block overpayment on a new payment (partial payments are fine).
        invoice = attrs.get("invoice")
        amount = attrs.get("amount")
        if invoice is not None and amount is not None and self.instance is None:
            if float(amount) > invoice.balance + 0.001:
                raise serializers.ValidationError({
                    "amount": f"Amount paid cannot exceed the outstanding balance "
                              f"(L${invoice.balance:,.2f})."
                })
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    amount_paid  = serializers.ReadOnlyField()
    balance      = serializers.ReadOnlyField()
    student_name = serializers.SerializerMethodField()
    student_sid  = serializers.SerializerMethodField()
    fee_display  = serializers.SerializerMethodField()
    payments     = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model  = Invoice
        fields = ["id", "invoice_number", "student", "student_name", "student_sid",
                  "semester", "fee_type", "fee_type_ref", "fee_label", "fee_display",
                  "amount", "due_date", "status",
                  "notes", "created_by", "created_at", "amount_paid", "balance", "payments"]
        read_only_fields = ["invoice_number", "created_at"]

    def get_student_name(self, obj) -> str:
        return obj.student.full_name

    def get_student_sid(self, obj) -> str:
        return obj.student.student_id

    def get_fee_display(self, obj) -> str:
        return obj.fee_label or obj.get_fee_type_display()

    def create(self, validated_data):
        validated_data.setdefault("created_by", self.context["request"].user)
        # Snapshot the catalogue name onto the invoice so it survives a rename.
        ref = validated_data.get("fee_type_ref")
        if ref and not validated_data.get("fee_label"):
            validated_data["fee_label"] = ref.name
        # generate_number() reads the last invoice without locking, so two
        # concurrent requests can compute the same number — retry on the
        # unique-constraint violation rather than 500ing one of them.
        for attempt in range(5):
            validated_data["invoice_number"] = Invoice.generate_number()
            try:
                with transaction.atomic():
                    return super().create(validated_data)
            except IntegrityError:
                if attempt == 4:
                    raise


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Receipt
        fields = ["id", "payment", "receipt_number", "pdf_file", "generated_at"]


class FeeTypeViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    """Fee-type catalogue. Unlike invoices/payments (finance-officer-only data
    entry, admin view-only), the spec gives the admin full control here too —
    so both admin and finance officer can create/edit/deactivate, and either
    can soft-delete (admins restore from Trash). Every action is audited via
    AuditLogMixin (module "Finance")."""
    audit_module = "Finance"
    queryset = FeeType.objects.select_related("academic_year", "semester", "default_class").all()
    serializer_class   = FeeTypeSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrFinanceOfficer]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["applies_to", "is_active", "academic_year", "semester"]


class InvoiceViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Finance"
    queryset = Invoice.objects.select_related("student", "semester", "fee_type_ref").prefetch_related("payments__receipt").all()
    serializer_class   = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "status", "semester", "fee_type", "fee_type_ref"]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("admin", "finance_officer"):
            return super().get_queryset()
        return scope_to_own_student(super().get_queryset(), user,
                                    prefix="student", teacher_sees_classes=False)

    def get_permissions(self):
        # Data entry is finance-officer only; admins are view-only (they still
        # read everything via get_queryset, but cannot create/edit/delete).
        if self.action in ("create", "update", "partial_update", "destroy", "assign"):
            return [permissions.IsAuthenticated(), IsFinanceOfficer()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        # AuditLogMixin.perform_create logs the CREATE; then notify the student/
        # guardians (best-effort — never block the write on a notification).
        super().perform_create(serializer)
        try:
            from apps.notifications.services import notify_invoice_created
            notify_invoice_created(serializer.instance, created_by=self.request.user)
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to send invoice notifications")

    @action(detail=False, methods=["post"], url_path="assign")
    def assign(self, request):
        """Bulk fee assignment: raise an invoice from a fee type for one student,
        a whole class, or all students (optionally filtered by academic year).
        Skips students who already have a non-cancelled invoice for the same fee
        type + semester, so re-running doesn't double-bill."""
        from apps.students.models import Student

        data = request.data
        fee = FeeType.objects.filter(id=data.get("fee_type")).first() if data.get("fee_type") else None

        due_date = data.get("due_date")
        if not due_date:
            return Response({"detail": "Due date is required."}, status=400)

        amount = data.get("amount")
        if amount in (None, ""):
            amount = fee.default_amount if fee else None
        if amount in (None, ""):
            return Response({"detail": "Amount is required (no default on the fee type)."}, status=400)

        semester_id = data.get("semester") or (fee.semester_id if fee else None)
        label = (fee.name if fee else data.get("fee_label", "")) or ""
        notes = data.get("description", "")
        scope = data.get("scope", "all")

        # ── Resolve the target students ───────────────────────────
        students = Student.objects.all()
        if scope == "student":
            ids = data.get("student_ids")
            if not ids:
                single = data.get("student")
                ids = [single] if single else []
            if not ids:
                return Response({"detail": "Select at least one student."}, status=400)
            students = students.filter(id__in=ids)
        elif scope == "class":
            class_id = data.get("class_id")
            if not class_id:
                return Response({"detail": "Select a class."}, status=400)
            students = students.filter(current_class_id=class_id)
        elif scope != "all":
            return Response({"detail": "Invalid scope."}, status=400)

        academic_year = data.get("academic_year")
        if academic_year:
            students = students.filter(current_class__academic_year_id=academic_year)

        students = list(students)
        if not students:
            return Response({"detail": "No matching students to invoice."}, status=400)

        fee_enum = _guess_fee_enum(label)
        created, skipped = [], 0
        for student in students:
            if fee and Invoice.objects.filter(
                student=student, fee_type_ref=fee, semester_id=semester_id
            ).exclude(status=Invoice.Status.CANCELLED).exists():
                skipped += 1
                continue
            invoice = self._create_invoice(
                student=student, amount=amount, due_date=due_date,
                semester_id=semester_id, fee=fee, fee_label=label,
                fee_enum=fee_enum, notes=notes, created_by=request.user,
            )
            if invoice:
                created.append(invoice)

        log_action(
            action=AuditAction.CREATE, module="Finance", request=request,
            object_name=label or "Fee assignment",
            description=f"Assigned '{label or 'fee'}' to {len(created)} student(s) "
                        f"({scope}); {skipped} skipped (already invoiced).",
        )
        try:
            from apps.notifications.services import notify_invoice_created
            notify_invoice_created(created, created_by=request.user)
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to send invoice notifications")

        return Response({
            "created": len(created),
            "skipped": skipped,
            "invoice_numbers": [inv.invoice_number for inv in created],
        })

    @staticmethod
    def _create_invoice(*, student, amount, due_date, semester_id, fee,
                        fee_label, fee_enum, notes, created_by):
        for attempt in range(5):
            try:
                with transaction.atomic():
                    return Invoice.objects.create(
                        invoice_number=Invoice.generate_number(),
                        student=student, amount=amount, due_date=due_date,
                        semester_id=semester_id, fee_type=fee_enum,
                        fee_type_ref=fee, fee_label=fee_label,
                        notes=notes, created_by=created_by,
                    )
            except IntegrityError:
                if attempt == 4:
                    raise
        return None


class PaymentViewSet(SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice", "received_by", "receipt").all()
    serializer_class   = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["invoice", "method", "is_verified"]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("admin", "finance_officer"):
            return super().get_queryset()
        return scope_to_own_student(super().get_queryset(), user,
                                    prefix="invoice__student", teacher_sees_classes=False)

    def get_permissions(self):
        # Data entry is finance-officer only; admins are view-only (they still
        # read everything via get_queryset, but cannot create/edit/delete).
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsFinanceOfficer()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)
        payment = serializer.instance

        # Generate the receipt for this payment (retry on the unlikely
        # receipt-number collision, same as invoice numbering).
        for attempt in range(5):
            try:
                with transaction.atomic():
                    Receipt.objects.create(payment=payment, receipt_number=Receipt.generate_number())
                break
            except IntegrityError:
                if attempt == 4:
                    import logging
                    logging.getLogger(__name__).exception("Failed to generate receipt")

        log_action(
            action=AuditAction.PAYMENT_CREATE, module="Finance", request=self.request,
            obj=payment, description=f"Recorded payment: {payment}",
            new_value=serialize_instance(payment),
        )
        try:
            from apps.notifications.services import notify_payment_recorded
            notify_payment_recorded(payment)
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to send payment notifications")

    def perform_update(self, serializer):
        old_value = serialize_instance(serializer.instance) if serializer.instance else None
        serializer.save()
        payment = serializer.instance
        diff_old, diff_new = diff_snapshots(old_value, serialize_instance(payment))
        log_action(
            action=AuditAction.PAYMENT_EDIT, module="Finance", request=self.request,
            obj=payment, description=f"Edited payment: {payment}",
            old_value=diff_old, new_value=diff_new,
        )

    def perform_destroy(self, instance):
        old_value = serialize_instance(instance)
        object_id = str(getattr(instance, "pk", "") or "")
        object_name = str(instance)[:255]
        super().perform_destroy(instance)
        log_action(
            action=AuditAction.PAYMENT_VOID, module="Finance", request=self.request,
            object_id=object_id, object_name=object_name,
            description=f"Voided payment: {object_name}", old_value=old_value,
        )


class ReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = Receipt.objects.select_related(
        "payment", "payment__invoice", "payment__invoice__student", "payment__received_by"
    ).all()
    serializer_class   = ReceiptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("admin", "finance_officer"):
            return super().get_queryset()
        return scope_to_own_student(super().get_queryset(), user,
                                      prefix="payment__invoice__student", teacher_sees_classes=False)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """Stream the receipt as a freshly-rendered PDF. Scoped by get_queryset,
        so a student/guardian can only download their own receipts."""
        receipt = self.get_object()
        from django.http import HttpResponse
        from .receipts import render_receipt_pdf
        pdf = render_receipt_pdf(receipt)
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{receipt.receipt_number}.pdf"'
        return response
