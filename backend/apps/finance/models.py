from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from apps.students.models import Student, Semester


class Invoice(models.Model):
    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        PARTIAL   = "partial",   "Partially Paid"
        PAID      = "paid",      "Paid"
        OVERDUE   = "overdue",   "Overdue"
        CANCELLED = "cancelled", "Cancelled"

    class FeeType(models.TextChoices):
        TUITION  = "tuition",  "Tuition Fee"
        EXAM     = "exam",     "Exam Fee"
        ACTIVITY = "activity", "Activity Fee"
        UNIFORM  = "uniform",  "Uniform Fee"
        OTHER    = "other",    "Other"

    invoice_number = models.CharField(max_length=30, unique=True)
    student        = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="invoices")
    semester       = models.ForeignKey(Semester, on_delete=models.SET_NULL, null=True, blank=True)
    fee_type       = models.CharField(max_length=20, choices=FeeType.choices, default=FeeType.TUITION)
    amount         = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    due_date       = models.DateField()
    status         = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    notes          = models.TextField(blank=True)
    created_by     = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.invoice_number} – {self.student}"

    @property
    def amount_paid(self) -> float:
        return float(
            self.payments.filter(is_verified=True).aggregate(
                total=models.Sum("amount")
            )["total"] or 0
        )

    @property
    def balance(self) -> float:
        return float(self.amount) - self.amount_paid

    def refresh_status(self) -> None:
        if self.balance <= 0:
            self.status = self.Status.PAID
        elif self.amount_paid > 0:
            self.status = self.Status.PARTIAL
        elif self.due_date < timezone.now().date():
            self.status = self.Status.OVERDUE
        else:
            self.status = self.Status.PENDING
        self.save(update_fields=["status"])

    @classmethod
    def generate_number(cls) -> str:
        from datetime import date
        year = date.today().year
        last = cls.objects.filter(invoice_number__startswith=f"INV-{year}-").order_by("-invoice_number").first()
        seq  = 1
        if last:
            try:
                seq = int(last.invoice_number.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"INV-{year}-{seq:04d}"


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH          = "cash",          "Cash"
        BANK_TRANSFER = "bank_transfer", "Bank Transfer"
        MOBILE_MONEY  = "mobile_money",  "Mobile Money"
        CHEQUE        = "cheque",        "Cheque"

    invoice        = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="payments")
    amount         = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    method         = models.CharField(max_length=20, choices=Method.choices)
    reference_number = models.CharField(max_length=100, blank=True)
    payment_date   = models.DateField()
    received_by    = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True)
    is_verified    = models.BooleanField(default=True)
    notes          = models.TextField(blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.invoice.refresh_status()

    def __str__(self) -> str:
        return f"L${self.amount} via {self.method} on {self.payment_date}"


class Receipt(models.Model):
    payment      = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name="receipt")
    receipt_number = models.CharField(max_length=30, unique=True)
    pdf_file     = models.FileField(upload_to="receipts/", null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Receipt {self.receipt_number}"

