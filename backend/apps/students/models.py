from django.db import models
from apps.users.models import User


class AcademicYear(models.Model):
    name       = models.CharField(max_length=20, unique=True)   # "2025/2026"
    start_date = models.DateField()
    end_date   = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        ordering = ["-start_date"]

    def save(self, *args, **kwargs):
        if self.is_current:
            AcademicYear.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Semester(models.Model):
    class Number(models.IntegerChoices):
        FIRST  = 1, "Semester 1"
        SECOND = 2, "Semester 2"

    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="semesters")
    number        = models.IntegerField(choices=Number.choices)
    start_date    = models.DateField()
    end_date      = models.DateField()
    is_active     = models.BooleanField(default=False)
    marks_locked  = models.BooleanField(default=False)

    class Meta:
        unique_together = ("academic_year", "number")

    def __str__(self) -> str:
        return f"{self.academic_year} – Semester {self.number}"


class Subject(models.Model):
    """Configurable by admin — never hardcoded."""
    name       = models.CharField(max_length=100, unique=True)
    code       = models.CharField(max_length=20, unique=True)
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Class(models.Model):
    """e.g. Grade 12A, 9C"""
    name          = models.CharField(max_length=10)            # "12A"
    grade         = models.IntegerField()
    section       = models.CharField(max_length=5)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="classes")
    class_teacher = models.ForeignKey(
        "teachers.Teacher", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="homeroom_class",
    )

    class Meta:
        unique_together = ("grade", "section", "academic_year")
        ordering        = ["grade", "section"]

    def __str__(self) -> str:
        return f"Grade {self.name}"


class Guardian(models.Model):
    user         = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True, related_name="guardian_profile")
    full_name    = models.CharField(max_length=200)
    phone_number = models.CharField(max_length=30)
    email        = models.EmailField(blank=True)
    address      = models.TextField(blank=True)
    occupation   = models.CharField(max_length=100, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.full_name


class Student(models.Model):
    class Status(models.TextChoices):
        ACTIVE      = "active",      "Active"
        SUSPENDED   = "suspended",   "Suspended"
        TRANSFERRED = "transferred", "Transferred"
        GRADUATED   = "graduated",   "Graduated"
        WITHDRAWN   = "withdrawn",   "Withdrawn"

    class Gender(models.TextChoices):
        MALE   = "M", "Male"
        FEMALE = "F", "Female"

    # Admin enters a custom ID — e.g. CHS-2026-001
    student_id    = models.CharField(max_length=50, unique=True)
    user          = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="student_profile")
    first_name    = models.CharField(max_length=100)
    middle_name   = models.CharField(max_length=100, blank=True)
    last_name     = models.CharField(max_length=100)
    gender        = models.CharField(max_length=1, choices=Gender.choices)
    date_of_birth = models.DateField(null=True, blank=True)
    photo         = models.ImageField(upload_to="students/photos/", null=True, blank=True)
    current_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, related_name="students")
    status        = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    guardians     = models.ManyToManyField(Guardian, through="StudentGuardian", related_name="students")
    enrolled_at   = models.DateField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    @property
    def full_name(self) -> str:
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        parts.append(self.last_name)
        return " ".join(parts)

    def __str__(self) -> str:
        return f"{self.full_name} ({self.student_id})"


class StudentGuardian(models.Model):
    class Relationship(models.TextChoices):
        FATHER      = "father",      "Father"
        MOTHER      = "mother",      "Mother"
        UNCLE       = "uncle",       "Uncle"
        AUNT        = "aunt",        "Aunt"
        GRANDPARENT = "grandparent", "Grandparent"
        SIBLING     = "sibling",     "Sibling"
        OTHER       = "other",       "Other"

    student      = models.ForeignKey(Student, on_delete=models.CASCADE)
    guardian     = models.ForeignKey(Guardian, on_delete=models.CASCADE)
    relationship = models.CharField(max_length=20, choices=Relationship.choices)
    is_primary   = models.BooleanField(default=False)

    class Meta:
        unique_together = ("student", "guardian")
