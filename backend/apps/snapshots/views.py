import json
from datetime import datetime
from io import StringIO

from django.core.files.base import ContentFile
from django.core.management import call_command
from rest_framework import serializers, viewsets, permissions

from apps.trash.mixins import SoftDeleteViewSetMixin
from apps.users.views import IsAdminUser
from .models import Snapshot

# Maps the admin-facing "Include Data Options" checklist to the actual
# app_label/model pairs dumpdata should export for that selection.
# Deliberately excludes users.notification (system noise) and apps.trash/
# apps.snapshots themselves (no point snapshotting snapshots).
MODULE_MAP: dict[str, list[tuple[str, str]]] = {
    "users":      [("users", "User")],
    "students":   [("students", "Student")],
    "staff":      [("teachers", "Teacher"), ("teachers", "TeacherAssignment")],
    "classes":    [("students", "Class")],
    "subjects":   [("students", "Subject")],
    "attendance": [("attendance", "AttendanceRecord"), ("attendance", "AttendanceSummary")],
    "grades":     [("marks", "Mark"), ("marks", "GradingScale"), ("marks", "ConductCategory"),
                   ("marks", "ConductRating"), ("marks", "PromotionDecision")],
    "finance":    [("finance", "Invoice"), ("finance", "Payment"), ("finance", "Receipt")],
    "settings":   [("students", "AcademicYear"), ("students", "Semester")],
}
MODULE_CHOICES = list(MODULE_MAP.keys())


def build_snapshot_json(modules: list[str]) -> str:
    labels = [f"{app}.{model}" for slug in modules for app, model in MODULE_MAP.get(slug, [])]
    buffer = StringIO()
    call_command("dumpdata", *labels, indent=2, stdout=buffer)
    return buffer.getvalue()


class SnapshotSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()
    # Not persisted — just gates creation, matching the UI's confirmation
    # checkbox ("I understand this snapshot captures the selected data").
    confirm = serializers.BooleanField(write_only=True)

    class Meta:
        model = Snapshot
        fields = [
            "id", "name", "description", "snapshot_type", "included_modules",
            "status", "error_message", "file", "size_bytes", "record_count",
            "created_by_email", "created_at", "confirm",
        ]
        read_only_fields = ["status", "error_message", "file", "size_bytes", "record_count", "created_at"]

    def get_created_by_email(self, obj) -> str | None:
        return obj.created_by.email if obj.created_by else None

    def validate_name(self, value):
        # all_objects: a trashed snapshot's name is still physically unique
        # in the DB, so a collision with one needs to surface as a clean
        # 400 here rather than a raw IntegrityError later.
        if Snapshot.all_objects.filter(name=value).exists():
            raise serializers.ValidationError("A snapshot with this name already exists.")
        return value

    def validate_included_modules(self, value):
        if not value:
            raise serializers.ValidationError("Select at least one data type to include.")
        invalid = sorted(set(value) - set(MODULE_CHOICES))
        if invalid:
            raise serializers.ValidationError(f"Unknown data type(s): {', '.join(invalid)}.")
        return value

    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError("You must confirm before creating a snapshot.")
        return value

    def create(self, validated_data):
        validated_data.pop("confirm", None)
        request = self.context["request"]
        modules = validated_data["included_modules"]

        content = build_snapshot_json(modules)
        content_bytes = content.encode("utf-8")
        record_count = len(json.loads(content)) if content.strip() else 0

        snapshot = Snapshot(
            name=validated_data["name"],
            description=validated_data.get("description", ""),
            snapshot_type=validated_data.get("snapshot_type", Snapshot.SnapshotType.MANUAL),
            included_modules=modules,
            status=Snapshot.Status.COMPLETED,
            size_bytes=len(content_bytes),
            record_count=record_count,
            created_by=request.user,
        )
        filename = f"snapshot-{datetime.now():%Y%m%d-%H%M%S}.json"
        snapshot.file.save(filename, ContentFile(content_bytes), save=False)
        snapshot.save()
        return snapshot


class SnapshotViewSet(SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    queryset           = Snapshot.objects.all()
    serializer_class    = SnapshotSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    http_method_names   = ["get", "post", "delete", "head", "options"]  # no update — snapshots are immutable
