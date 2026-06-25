from django.db import IntegrityError, transaction
from rest_framework import serializers, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Invoice, Payment, Receipt
from apps.users.views import IsAdminUser, IsAdminOrFinanceOfficer, scope_to_own_student
from apps.trash.mixins import SoftDeleteViewSetMixin
from apps.audit.mixins import AuditLogMixin
from apps.audit.models import AuditAction
from apps.audit.services import log_action, serialize_instance, diff_snapshots


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Payment
        fields = ["id", "invoice", "amount", "method", "reference_number",
                  "payment_date", "received_by", "is_verified", "notes", "created_at"]
        read_only_fields = ["created_at"]


class InvoiceSerializer(serializers.ModelSerializer):
    amount_paid  = serializers.ReadOnlyField()
    balance      = serializers.ReadOnlyField()
    student_name = serializers.SerializerMethodField()
    student_sid  = serializers.SerializerMethodField()
    payments     = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model  = Invoice
        fields = ["id", "invoice_number", "student", "student_name", "student_sid",
                  "semester", "fee_type", "amount", "due_date", "status",
                  "notes", "created_by", "created_at", "amount_paid", "balance", "payments"]
        read_only_fields = ["invoice_number", "created_at"]

    def get_student_name(self, obj) -> str:
        return obj.student.full_name

    def get_student_sid(self, obj) -> str:
        return obj.student.student_id

    def create(self, validated_data):
        validated_data.setdefault("created_by", self.context["request"].user)
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


class InvoiceViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Finance"
    queryset = Invoice.objects.select_related("student", "semester").prefetch_related("payments").all()
    serializer_class   = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "status", "semester", "fee_type"]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("admin", "finance_officer"):
            return super().get_queryset()
        return scope_to_own_student(super().get_queryset(), user,
                                    prefix="student", teacher_sees_classes=False)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminOrFinanceOfficer()]
        return [permissions.IsAuthenticated()]


class PaymentViewSet(SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice", "received_by").all()
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
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminOrFinanceOfficer()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)
        payment = serializer.instance
        log_action(
            action=AuditAction.PAYMENT_CREATE, module="Finance", request=self.request,
            obj=payment, description=f"Recorded payment: {payment}",
            new_value=serialize_instance(payment),
        )

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
    queryset           = Receipt.objects.select_related("payment").all()
    serializer_class   = ReceiptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("admin", "finance_officer"):
            return super().get_queryset()
        return scope_to_own_student(super().get_queryset(), user,
                                      prefix="payment__invoice__student", teacher_sees_classes=False)
