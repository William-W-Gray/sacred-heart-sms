from django.db import models
from django.core.validators import MinValueValidator
from apps.students.models import Student, Subject, Class, Semester
from apps.trash.models import SoftDeleteModel


class AttendanceRecord(SoftDeleteModel):
    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        LATE    = "late",    "Late"
        ABSENT  = "absent",  "Absent"
        EXCUSED = "excused", "Excused"

    student     = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    subject     = models.ForeignKey(Subject, on_delete=models.CASCADE)
    class_group = models.ForeignKey(Class, on_delete=models.CASCADE)
    date        = models.DateField()
    status      = models.CharField(max_length=10, choices=Status.choices)
    recorded_by = models.ForeignKey("teachers.Teacher", on_delete=models.SET_NULL, null=True)
    notes       = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "subject", "date")
        ordering        = ["-date"]

    def __str__(self) -> str:
        return f"{self.student} – {self.subject} on {self.date}: {self.status}"


class AttendanceSummary(models.Model):
    """Pre-computed per student per semester — see attendance/services.py.
    Kept current automatically by AttendanceRecordViewSet.bulk; for backfills
    or drift, run `manage.py refresh_attendance_summaries`."""
    student    = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_summaries")
    semester   = models.ForeignKey(Semester, on_delete=models.CASCADE)
    total_days = models.IntegerField(default=0)
    days_present = models.IntegerField(default=0)
    days_late    = models.IntegerField(default=0)
    days_absent  = models.IntegerField(default=0)
    days_excused = models.IntegerField(default=0)
    computed_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("student", "semester")

    @property
    def attendance_rate(self) -> float:
        if self.total_days == 0:
            return 0.0
        return round((self.days_present + self.days_late) / self.total_days * 100, 1)
