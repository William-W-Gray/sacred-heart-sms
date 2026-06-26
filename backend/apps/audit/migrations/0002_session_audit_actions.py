"""Widen AuditAction.action choices to include the session-management events
(automatic timeout, session extended, forced logout). Choices aren't enforced
at the DB level, so this is a no-op for the column itself — it just keeps the
migration state in sync with the model.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("audit", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("login", "Login"),
                    ("logout", "Logout"),
                    ("session_timeout", "Automatic Session Timeout"),
                    ("session_extended", "Session Extended by User"),
                    ("forced_logout", "Forced Logout"),
                    ("create", "Create"),
                    ("update", "Update"),
                    ("delete", "Delete"),
                    ("restore", "Restore"),
                    ("permanent_delete", "Permanent Delete"),
                    ("snapshot_create", "Snapshot Create"),
                    ("snapshot_restore", "Snapshot Restore"),
                    ("settings_change", "Settings Change"),
                    ("profile_update", "Profile Update"),
                    ("role_permission_change", "Role/Permission Change"),
                    ("marks_entry", "Marks Entry"),
                    ("attendance_entry", "Attendance Entry"),
                    ("report_card_generation", "Report Card Generation"),
                    ("payment_create", "Payment Create"),
                    ("payment_edit", "Payment Edit"),
                    ("payment_void", "Payment Void"),
                ],
                db_index=True,
                max_length=30,
            ),
        ),
    ]
