from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.students.models import Student, Subject, Semester, AcademicYear, Class
from apps.trash.models import SoftDeleteModel


class GradingScale(SoftDeleteModel):
    """Never hardcode grade logic — store and look up from here."""
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="grading_scales")
    grade_letter  = models.CharField(max_length=2)    # A, B, C, D, F
    min_score     = models.DecimalField(max_digits=5, decimal_places=2)
    max_score     = models.DecimalField(max_digits=5, decimal_places=2)
    description   = models.CharField(max_length=50)  # "Excellent", "Good", …
    gpa_points    = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)

    class Meta:
        ordering        = ["-min_score"]
        unique_together = ("academic_year", "grade_letter")

    @classmethod
    def letter_for(cls, score: float, academic_year: AcademicYear) -> str:
        scale = cls.objects.filter(
            academic_year=academic_year,
            min_score__lte=score,
            max_score__gte=score,
        ).first()
        return scale.grade_letter if scale else "F"

    def __str__(self) -> str:
        return f"{self.grade_letter} ({self.min_score}–{self.max_score})"


class Mark(SoftDeleteModel):
    """Test + exam score per student per subject per semester."""
    student     = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="marks")
    subject     = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="marks")
    semester    = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="marks")
    recorded_by = models.ForeignKey("teachers.Teacher", on_delete=models.SET_NULL, null=True)

    test_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    exam_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    is_locked  = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("student", "subject", "semester")

    @property
    def semester_average(self) -> float | None:
        if self.test_score is not None and self.exam_score is not None:
            return round((float(self.test_score) + float(self.exam_score)) / 2, 2)
        return None

    def __str__(self) -> str:
        return f"{self.student} – {self.subject} S{self.semester.number}"


class StudentRanking(models.Model):
    student       = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="rankings")
    class_group   = models.ForeignKey(Class, on_delete=models.CASCADE)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    semester      = models.ForeignKey(Semester, on_delete=models.CASCADE, null=True, blank=True)
    total_score   = models.DecimalField(max_digits=7, decimal_places=2)
    average_score = models.DecimalField(max_digits=5, decimal_places=2)
    class_rank    = models.IntegerField()
    class_size    = models.IntegerField()
    computed_at   = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("student", "academic_year", "semester")


class ConductCategory(SoftDeleteModel):
    name      = models.CharField(max_length=100, unique=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class ConductRating(SoftDeleteModel):
    student   = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="conduct_ratings")
    category  = models.ForeignKey(ConductCategory, on_delete=models.CASCADE)
    semester  = models.ForeignKey(Semester, on_delete=models.CASCADE)
    rated_by  = models.ForeignKey("teachers.Teacher", on_delete=models.SET_NULL, null=True)
    rating    = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(6)])
    notes     = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("student", "category", "semester")

    def __str__(self) -> str:
        return f"{self.student} – {self.category}: {self.rating}/6"


class PromotionDecision(SoftDeleteModel):
    class Decision(models.TextChoices):
        PROMOTED      = "promoted",      "Promoted"
        CONDITIONED   = "conditioned",   "Conditioned"
        RETAINED      = "retained",      "Retained"
        NOT_RETURNING = "not_returning", "Not Returning"

    student       = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="promotions")
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    current_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="promotion_decisions")
    next_class    = models.ForeignKey(Class, on_delete=models.CASCADE, null=True, blank=True, related_name="incoming_promotions")
    decision      = models.CharField(max_length=20, choices=Decision.choices)
    decided_by    = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True)
    reason        = models.TextField(blank=True)
    decided_at    = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "academic_year")

    def __str__(self) -> str:
        return f"{self.student} – {self.decision} ({self.academic_year})"
