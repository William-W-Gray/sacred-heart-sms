"""
apps/audit/models.py

Immutable audit trail. Every security- or data-relevant action (logins,
CRUD, restores, snapshots, settings/role changes, marks/attendance entry,
payments) is recorded as one AuditLog row by apps.audit.services.log_action.

This is deliberately NOT a SoftDeleteModel: audit records are append-only and
must never be edited or trashed from the UI. The list API is read-only and
admin-only (see apps/audit/views.py). actor_email / actor_role are
denormalised copies so the record stays meaningful even after the underlying
User is deleted (FK is SET_NULL).
"""
from django.conf import settings
from django.db import models


class AuditAction(models.TextChoices):
    LOGIN                  = "login",                  "Login"
    LOGOUT                 = "logout",                 "Logout"
    SESSION_TIMEOUT        = "session_timeout",        "Automatic Session Timeout"
    SESSION_EXTENDED       = "session_extended",       "Session Extended by User"
    FORCED_LOGOUT          = "forced_logout",          "Forced Logout"
    CREATE                 = "create",                 "Create"
    UPDATE                 = "update",                 "Update"
    DELETE                 = "delete",                 "Delete"
    RESTORE                = "restore",                "Restore"
    PERMANENT_DELETE       = "permanent_delete",       "Permanent Delete"
    SNAPSHOT_CREATE        = "snapshot_create",        "Snapshot Create"
    SNAPSHOT_RESTORE       = "snapshot_restore",       "Snapshot Restore"
    SETTINGS_CHANGE        = "settings_change",        "Settings Change"
    PROFILE_UPDATE         = "profile_update",         "Profile Update"
    ROLE_PERMISSION_CHANGE = "role_permission_change", "Role/Permission Change"
    MARKS_ENTRY            = "marks_entry",            "Marks Entry"
    ATTENDANCE_ENTRY       = "attendance_entry",       "Attendance Entry"
    REPORT_CARD_GENERATION = "report_card_generation", "Report Card Generation"
    PAYMENT_CREATE         = "payment_create",         "Payment Create"
    PAYMENT_EDIT           = "payment_edit",           "Payment Edit"
    PAYMENT_VOID           = "payment_void",           "Payment Void"


class AuditLog(models.Model):
    actor       = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="audit_logs",
    )
    actor_email = models.CharField(max_length=254, blank=True)
    actor_role  = models.CharField(max_length=30, blank=True)

    action      = models.CharField(max_length=30, choices=AuditAction.choices, db_index=True)
    module      = models.CharField(max_length=50, blank=True, db_index=True)
    object_id   = models.CharField(max_length=64, blank=True)
    object_name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)

    old_value   = models.JSONField(null=True, blank=True)
    new_value   = models.JSONField(null=True, blank=True)

    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    user_agent  = models.TextField(blank=True)

    timestamp   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["-timestamp"]),
            models.Index(fields=["action", "-timestamp"]),
            models.Index(fields=["module", "-timestamp"]),
        ]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def __str__(self) -> str:
        who = self.actor_email or "system"
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {who} {self.action} {self.module}"
