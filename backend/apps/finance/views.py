from rest_framework import serializers, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Invoice, Payment, Receipt
from apps.users.views import IsAdminUser, scope_to_own_student


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
        validated_data["invoice_number"] = Invoice.generate_number()
        validated_data.setdefault("created_by", self.context["request"].user)
        return super().create(validated_data)


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Receipt
        fields = ["id", "payment", "receipt_number", "pdf_file", "generated_at"]


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related("student", "semester").prefetch_related("payments").all()
    serializer_class   = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "status", "semester", "fee_type"]

    def get_queryset(self):
        return scope_to_own_student(super().get_queryset(), self.request.user,
                                      prefix="student", teacher_sees_classes=False)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice", "received_by").all()
    serializer_class   = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["invoice", "method", "is_verified"]

    def get_queryset(self):
        return scope_to_own_student(super().get_queryset(), self.request.user,
                                      prefix="invoice__student", teacher_sees_classes=False)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)


class ReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = Receipt.objects.select_related("payment").all()
    serializer_class   = ReceiptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return scope_to_own_student(super().get_queryset(), self.request.user,
                                      prefix="payment__invoice__student", teacher_sees_classes=False)
