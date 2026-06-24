from django.db import models
from apps.users.models import User
from apps.students.models import Class, Subject, AcademicYear


class Teacher(models.Model):
    user        = models.OneToOneField(User, on_delete=models.CASCADE, related_name="teacher_profile")
    full_name   = models.CharField(max_length=200)
    email       = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=30, blank=True)
    subject     = models.CharField(max_length=100, blank=True)
    employee_id = models.CharField(max_length=50, unique=True, blank=True)
    photo       = models.ImageField(upload_to="teachers/photos/", null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.full_name

    def can_record_for(self, class_obj: Class, subject: Subject) -> bool:
        """Enforce: teacher can only interact with their assigned class/subject pairs."""
        return self.assignments.filter(
            assigned_class=class_obj,
            subject=subject,
            is_active=True,
        ).exists()


class TeacherAssignment(models.Model):
    """
    One subject → one teacher per class per academic year.
    One teacher can cover multiple subjects / classes.
    """
    teacher        = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name="assignments")
    assigned_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="teacher_assignments")
    subject        = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="teacher_assignments")
    academic_year  = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    is_active      = models.BooleanField(default=True)
    assigned_at    = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ("assigned_class", "subject", "academic_year")

    def __str__(self) -> str:
        return f"{self.teacher} → {self.subject} ({self.assigned_class})"
