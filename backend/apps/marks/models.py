from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
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


class AssessmentTemplate(SoftDeleteModel):
    """Admin-defined assessment component (e.g. "Quiz 1", "Mid-Term Test") with a
    weight and max score, optionally scoped to a class/subject/semester.

    This is a *configuration* layer: it documents the school's grading structure
    and drives max-score validation in the marks-entry UI. It deliberately does
    NOT change how `Mark` stores scores (still test + exam) or how
    `marks/services.py` computes averages — keeping the fragile grade pipeline
    untouched. A null class/subject/semester means "applies to all".
    """
    class Kind(models.TextChoices):
        ASSIGNMENT = "assignment", "Assignment / Homework"
        QUIZ       = "quiz",       "Quiz"
        TEST       = "test",       "Test"
        EXAM       = "exam",       "Exam"

    name          = models.CharField(max_length=100)
    kind          = models.CharField(max_length=20, choices=Kind.choices, default=Kind.TEST)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="assessment_templates")
    semester      = models.ForeignKey(Semester, on_delete=models.CASCADE, null=True, blank=True, related_name="assessment_templates")
    class_group   = models.ForeignKey(Class, on_delete=models.CASCADE, null=True, blank=True, related_name="assessment_templates")
    subject       = models.ForeignKey(Subject, on_delete=models.CASCADE, null=True, blank=True, related_name="assessment_templates")
    max_score     = models.DecimalField(
        max_digits=6, decimal_places=2, default=100,
        validators=[MinValueValidator(0)],
    )
    weight        = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Contribution to the subject total, as a percentage.",
    )
    is_active     = models.BooleanField(default=True)
    sort_order    = models.IntegerField(default=0)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "kind", "name"]

    def __str__(self) -> str:
        scope = self.subject.name if self.subject else "All subjects"
        return f"{self.name} · {self.get_kind_display()} · {scope}"


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


class AcademicTaskWindow(SoftDeleteModel):
    """Admin-configured open/close window that governs WHEN a teacher may perform
    an academic duty (attendance, marks, conduct, report comments) for a scope of
    class / subject / teacher / semester.

    Safe-additive by design: if no window matches a given write, that write is
    unrestricted — exactly as before this model existed. Locking only takes
    effect once an admin creates a window that is (or becomes) closed/read-only.
    The most *specific* matching window wins, so a school can close everything
    and selectively reopen one class, or vice-versa. See
    apps.marks.services.assert_task_open / find_locking_window for enforcement.
    """
    class TaskType(models.TextChoices):
        ATTENDANCE     = "attendance",     "Attendance"
        ASSIGNMENT     = "assignment",     "Assignment / Homework"
        QUIZ           = "quiz",           "Quiz Marks"
        TEST           = "test",           "Test Marks"
        EXAM           = "exam",           "Exam Marks"
        CONDUCT        = "conduct",        "Conduct Entry"
        REPORT_COMMENT = "report_comment", "Report Card Comments"

    class Status(models.TextChoices):
        AUTO     = "auto",     "Automatic (by date/time)"
        OPEN     = "open",     "Open"
        CLOSED   = "closed",   "Closed"
        READONLY = "readonly", "Read-Only"

    task_type      = models.CharField(max_length=20, choices=TaskType.choices, db_index=True)
    academic_year  = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="task_windows")
    semester       = models.ForeignKey(Semester, on_delete=models.CASCADE, null=True, blank=True, related_name="task_windows")
    assigned_class = models.ForeignKey(Class, on_delete=models.CASCADE, null=True, blank=True, related_name="task_windows")
    subject        = models.ForeignKey(Subject, on_delete=models.CASCADE, null=True, blank=True, related_name="task_windows")
    teacher        = models.ForeignKey("teachers.Teacher", on_delete=models.CASCADE, null=True, blank=True, related_name="task_windows")
    open_at        = models.DateTimeField(null=True, blank=True)
    close_at       = models.DateTimeField(null=True, blank=True)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.AUTO)
    note           = models.CharField(max_length=255, blank=True)
    created_by     = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def effective_status(self, now=None) -> str:
        """Resolve the real status right now: manual overrides win, otherwise
        AUTO derives Open/Closed from the open_at/close_at window."""
        if self.status == self.Status.READONLY:
            return self.Status.READONLY
        if self.status == self.Status.CLOSED:
            return self.Status.CLOSED
        if self.status == self.Status.OPEN:
            return self.Status.OPEN
        now = now or timezone.now()
        if self.open_at and now < self.open_at:
            return self.Status.CLOSED   # not opened yet
        if self.close_at and now > self.close_at:
            return self.Status.CLOSED   # deadline passed
        return self.Status.OPEN

    @property
    def is_editable_now(self) -> bool:
        return self.effective_status() == self.Status.OPEN

    def specificity(self) -> int:
        """How many scope fields are pinned (vs. wildcard) — the most specific
        matching window decides a given write."""
        return sum(1 for f in (self.semester_id, self.assigned_class_id, self.subject_id, self.teacher_id) if f is not None)

    def __str__(self) -> str:
        scope = str(self.assigned_class) if self.assigned_class else "All classes"
        return f"{self.get_task_type_display()} · {scope} · {self.effective_status()}"
