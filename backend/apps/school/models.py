"""
apps/school/models.py

SchoolProfile — a singleton holding the institution's identity (name, logo,
contacts, motto, principal). There is exactly one row (pk=1); the API never
creates a second. These values feed report-card headers and dashboards, so
they are read-only to everyone but admins (enforced in the view).
"""
from django.conf import settings
from django.db import models


class SchoolProfile(models.Model):
    """The school's organisation profile. Treated as a singleton (always pk=1)."""

    school_name    = models.CharField(max_length=200, default="Sacred Heart Catholic High School")
    logo           = models.ImageField(upload_to="school/", null=True, blank=True)
    address        = models.CharField(max_length=255, blank=True, default="Monrovia, Liberia")
    phone          = models.CharField(max_length=50, blank=True)
    email          = models.EmailField(blank=True)
    motto          = models.CharField(max_length=200, blank=True, default="Ora et Labora")
    principal_name = models.CharField(max_length=150, blank=True)

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "School Profile"
        verbose_name_plural = "School Profile"

    def __str__(self) -> str:
        return self.school_name

    @classmethod
    def load(cls) -> "SchoolProfile":
        """Return the singleton row, creating it with defaults if absent."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        # Pin to a single row so there can never be more than one profile.
        self.pk = 1
        super().save(*args, **kwargs)


class ReportCardTemplate(models.Model):
    """Singleton (always pk=1) controlling how report cards are rendered:
    which sections are visible and the editable header/label/footer text.

    This drives the *frontend* report-card renderer — it does not change the
    underlying report-card data assembled in `marks/services.py`. Changes are
    audited (SETTINGS_CHANGE) so the audit trail is the version history.
    """
    header_line             = models.CharField(max_length=120, blank=True, default="Republic of Liberia")
    show_logo               = models.BooleanField(default=True)
    show_motto              = models.BooleanField(default=True)
    show_conduct            = models.BooleanField(default=True)
    show_attendance         = models.BooleanField(default=True)
    show_finance_balance    = models.BooleanField(default=False)
    show_grading_scale      = models.BooleanField(default=True)
    teacher_comment_label   = models.CharField(max_length=80, blank=True, default="Class Teacher's Comment")
    principal_comment_label = models.CharField(max_length=80, blank=True, default="Principal's Comment")
    principal_signature     = models.CharField(max_length=120, blank=True)
    footer_text             = models.CharField(max_length=200, blank=True)

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "Report Card Template"
        verbose_name_plural = "Report Card Template"

    def __str__(self) -> str:
        return "Report Card Template"

    @classmethod
    def load(cls) -> "ReportCardTemplate":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
