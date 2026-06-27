from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from apps.students.models import Student, Semester, AcademicYear, Class
from apps.trash.models import SoftDeleteModel


class FeeType(SoftDeleteModel):
    """A reusable fee definition the finance office manages (Tuition, Exam Fee,
    PTA Fee…). It's a *catalogue* entry with a default amount and a default
    scope; the actual student invoices are generated from it in the fee-
    assignment workflow. Soft-deletable so an admin can trash/restore one
    without losing the invoices already raised against it.
    """
    class AppliesTo(models.TextChoices):
        ALL     = "all",     "All Students"
        CLASS   = "class",   "Specific Class"
        STUDENT = "student", "Individual Student"

    name           = models.CharField(max_length=100)
    description    = models.TextField(blank=True)
    default_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        validators=[MinValueValidator(0)],
    )
    applies_to     = models.CharField(max_length=10, choices=AppliesTo.choices, default=AppliesTo.ALL)
    academic_year  = models.ForeignKey(AcademicYear, on_delete=models.SET_NULL, null=True, blank=True, related_name="fee_types")
    semester       = models.ForeignKey(Semester, on_delete=models.SET_NULL, null=True, blank=True, related_name="fee_types")
    # Optional default target for a CLASS-scoped fee — a convenience pre-fill
    # for the assignment step; the officer can still override it there.
    default_class  = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, blank=True, related_name="fee_types")
    is_active      = models.BooleanField(default=True)
    created_by     = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, related_name="+")
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Invoice(SoftDeleteModel):
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
    # Link to the managed fee-type catalogue (FeeTypeDef). `fee_label` snapshots
    # the catalogue name at creation time so the invoice still reads correctly
    # even if the catalogue entry is later renamed or trashed.
    fee_type_ref   = models.ForeignKey("finance.FeeType", on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices")
    fee_label      = models.CharField(max_length=100, blank=True)
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
        # all_objects, not objects: a trashed invoice's number is still
        # physically unique in the DB, so a sequence based on the filtered
        # manager could regenerate the same number every retry and never
        # succeed (unlike the random employee_id/student_id generators,
        # this one is deterministic — it won't pick something else next time).
        last = cls.all_objects.filter(invoice_number__startswith=f"INV-{year}-").order_by("-invoice_number").first()
        seq  = 1
        if last:
            try:
                seq = int(last.invoice_number.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"INV-{year}-{seq:04d}"

    def get_cascade_querysets(self):
        return [(Payment, {"invoice": self})]


class Payment(SoftDeleteModel):
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

    @classmethod
    def generate_number(cls) -> str:
        from datetime import date
        year = date.today().year
        last = cls.objects.filter(receipt_number__startswith=f"RCP-{year}-").order_by("-receipt_number").first()
        seq = 1
        if last:
            try:
                seq = int(last.receipt_number.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"RCP-{year}-{seq:04d}"

