"""
apps/school/views.py

A single endpoint, /api/school-profile/, exposing the SchoolProfile singleton.

- GET    — any authenticated user (report cards / dashboards read it)
- PUT/PATCH — admin only; writes an audited SETTINGS_CHANGE with a before/after
  diff via the same audit service the viewsets use.
"""
from rest_framework import generics, permissions, serializers

from apps.users.views import IsAdminUser
from apps.audit.models import AuditAction
from apps.audit.services import log_action, serialize_instance, diff_snapshots

from .models import SchoolProfile, ReportCardTemplate


class SchoolProfileSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = SchoolProfile
        fields = [
            "id", "school_name", "logo", "address", "phone", "email",
            "motto", "principal_name", "updated_at", "updated_by", "updated_by_name",
        ]
        read_only_fields = ["id", "updated_at", "updated_by", "updated_by_name"]

    def get_updated_by_name(self, obj) -> str | None:
        if obj.updated_by:
            name = f"{obj.updated_by.first_name} {obj.updated_by.last_name}".strip()
            return name or obj.updated_by.email
        return None


class SchoolProfileView(generics.RetrieveUpdateAPIView):
    """Singleton: always resolves to SchoolProfile.load() regardless of URL pk."""
    serializer_class = SchoolProfileSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_object(self):
        return SchoolProfile.load()

    def perform_update(self, serializer):
        old_value = serialize_instance(serializer.instance)
        instance  = serializer.save(updated_by=self.request.user)
        diff_old, diff_new = diff_snapshots(old_value, serialize_instance(instance))
        # Nothing actually changed (e.g. an identical PATCH) — don't log noise.
        if diff_new:
            log_action(
                action=AuditAction.SETTINGS_CHANGE,
                module="Settings",
                request=self.request,
                obj=instance,
                object_name="School Profile",
                description="Updated School Profile",
                old_value=diff_old,
                new_value=diff_new,
            )


class ReportCardTemplateSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ReportCardTemplate
        fields = [
            "id", "header_line", "show_logo", "show_motto", "show_conduct",
            "show_attendance", "show_finance_balance", "show_grading_scale",
            "teacher_comment_label", "principal_comment_label",
            "principal_signature", "footer_text",
            "updated_at", "updated_by", "updated_by_name",
        ]
        read_only_fields = ["id", "updated_at", "updated_by", "updated_by_name"]

    def get_updated_by_name(self, obj) -> str | None:
        if obj.updated_by:
            name = f"{obj.updated_by.first_name} {obj.updated_by.last_name}".strip()
            return name or obj.updated_by.email
        return None


class ReportCardTemplateView(generics.RetrieveUpdateAPIView):
    """Singleton report-card layout/visibility config. Read-any, write-admin."""
    serializer_class = ReportCardTemplateSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_object(self):
        return ReportCardTemplate.load()

    def perform_update(self, serializer):
        old_value = serialize_instance(serializer.instance)
        instance  = serializer.save(updated_by=self.request.user)
        diff_old, diff_new = diff_snapshots(old_value, serialize_instance(instance))
        if diff_new:
            log_action(
                action=AuditAction.SETTINGS_CHANGE,
                module="Settings",
                request=self.request,
                obj=instance,
                object_name="Report Card Template",
                description="Updated Report Card Template",
                old_value=diff_old,
                new_value=diff_new,
            )
