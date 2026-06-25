import json
from datetime import datetime
from io import StringIO

from django.core.files.base import ContentFile
from django.core.management import call_command
from rest_framework import serializers, viewsets, permissions

from apps.users.views import IsAdminUser
from .models import Snapshot

# Every app whose data actually matters for recovering the school's
# records. Deliberately excludes users.notification (system noise, not
# data anyone needs backed up) and apps.trash (no concrete models).
SNAPSHOT_APPS = ["users.user", "students", "teachers", "attendance", "marks", "finance"]


def build_snapshot_json() -> str:
    buffer = StringIO()
    call_command("dumpdata", *SNAPSHOT_APPS, indent=2, stdout=buffer)
    return buffer.getvalue()


class SnapshotSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()
    record_count      = serializers.SerializerMethodField()

    class Meta:
        model = Snapshot
        fields = ["id", "label", "file", "size_bytes", "created_by_email", "record_count", "created_at"]
        read_only_fields = ["file", "size_bytes", "created_at"]

    def get_created_by_email(self, obj) -> str | None:
        return obj.created_by.email if obj.created_by else None

    def get_record_count(self, obj) -> int | None:
        # Cheap enough to recompute on read; these files are small JSON,
        # not full DB dumps.
        try:
            with obj.file.open("r") as f:
                return len(json.load(f))
        except Exception:
            return None

    def create(self, validated_data):
        request = self.context["request"]
        content = build_snapshot_json()
        content_bytes = content.encode("utf-8")

        snapshot = Snapshot(
            label=validated_data.get("label", ""),
            created_by=request.user,
            size_bytes=len(content_bytes),
        )
        filename = f"snapshot-{datetime.now():%Y%m%d-%H%M%S}.json"
        snapshot.file.save(filename, ContentFile(content_bytes), save=False)
        snapshot.save()
        return snapshot


class SnapshotViewSet(viewsets.ModelViewSet):
    queryset           = Snapshot.objects.all()
    serializer_class    = SnapshotSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    http_method_names   = ["get", "post", "delete", "head", "options"]  # no update — snapshots are immutable
