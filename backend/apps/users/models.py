from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email: str, password: str = None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ADMIN    = "admin",    "Administrator"
        TEACHER  = "teacher",  "Teacher"
        STUDENT  = "student",  "Student"
        GUARDIAN = "guardian", "Guardian"

    email      = models.EmailField(unique=True)
    role       = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["role"]
    objects = UserManager()

    # ── RBAC helpers ───────────────────────────────────────────
    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_teacher(self) -> bool:
        return self.role == self.Role.TEACHER

    @property
    def is_student(self) -> bool:
        return self.role == self.Role.STUDENT

    @property
    def is_guardian(self) -> bool:
        return self.role == self.Role.GUARDIAN

    def has_role(self, *roles) -> bool:
        return self.role in roles

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self) -> str:
        return f"{self.email} ({self.role})"


class Notification(models.Model):
    class Type(models.TextChoices):
        REPORT_CARD       = "report_card",       "New Report Card"
        FEE_REMINDER      = "fee_reminder",      "Fee Reminder"
        ATTENDANCE_ALERT  = "attendance_alert",  "Attendance Alert"
        PROMOTION         = "promotion",         "Promotion Update"
        GENERAL           = "general",           "General"

    class Channel(models.TextChoices):
        IN_APP   = "in_app",   "In-App"
        EMAIL    = "email",    "Email"
        WHATSAPP = "whatsapp", "WhatsApp"

    recipient         = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=30, choices=Type.choices)
    channel           = models.CharField(max_length=20, choices=Channel.choices, default=Channel.IN_APP)
    title             = models.CharField(max_length=200)
    body              = models.TextField()
    is_read           = models.BooleanField(default=False)
    metadata          = models.JSONField(default=dict, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.channel}] {self.title} → {self.recipient.email}"

    @classmethod
    def send(cls, *, recipient: User, type: str, title: str, body: str,
             channel: str = Channel.IN_APP, metadata: dict = None):
        notif = cls.objects.create(
            recipient=recipient, notification_type=type,
            channel=channel, title=title, body=body,
            metadata=metadata or {},
        )
        if channel == cls.Channel.EMAIL:
            from apps.notifications.tasks import dispatch_email
            dispatch_email.delay(notif.id)
        return notif
