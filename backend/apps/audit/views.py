"""
apps/audit/views.py

Read-only, admin-only API over the audit trail.

  GET /api/audit-logs/        paginated list (newest first)
  GET /api/audit-logs/{id}/   single record (for the detail modal)
  GET /api/audit-logs/meta/   distinct actions/modules/actors for filter UIs

Supports: ?search= (free text), ?action=, ?module=, ?actor=<email>,
?date_from=, ?date_to= (YYYY-MM-DD), ?ordering=, and ?page_size= (1–100) so
the frontend's row-count selector (5/10/20/50/100) maps straight through.
"""
import django_filters
from rest_framework import serializers, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.users.views import IsAdminUser
from .models import AuditLog, AuditAction


class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    actor_name     = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "actor", "actor_email", "actor_name", "actor_role",
            "action", "action_display", "module", "object_id", "object_name",
            "description", "old_value", "new_value",
            "ip_address", "user_agent", "timestamp",
        ]
        read_only_fields = fields

    def get_actor_name(self, obj) -> str:
        if obj.actor:
            full = f"{obj.actor.first_name} {obj.actor.last_name}".strip()
            return full or obj.actor.email
        return obj.actor_email or "System"


class AuditLogPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class AuditLogFilter(django_filters.FilterSet):
    action    = django_filters.CharFilter(field_name="action", lookup_expr="iexact")
    module    = django_filters.CharFilter(field_name="module", lookup_expr="iexact")
    actor     = django_filters.CharFilter(field_name="actor_email", lookup_expr="icontains")
    date_from = django_filters.DateFilter(field_name="timestamp", lookup_expr="date__gte")
    date_to   = django_filters.DateFilter(field_name="timestamp", lookup_expr="date__lte")

    class Meta:
        model = AuditLog
        fields = ["action", "module", "actor", "date_from", "date_to"]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only. Teachers/students/guardians get 403 (IsAdminUser)."""
    queryset           = AuditLog.objects.select_related("actor").all()
    serializer_class    = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    pagination_class    = AuditLogPagination
    filterset_class     = AuditLogFilter
    search_fields       = ["actor_email", "object_name", "description", "object_id", "ip_address"]
    ordering_fields     = ["timestamp", "action", "module", "actor_email"]
    ordering            = ["-timestamp"]

    @action(detail=False, methods=["get"])
    def meta(self, request):
        """Filter-dropdown source: every action choice plus the modules and
        actors actually present in the log."""
        modules = list(
            AuditLog.objects.exclude(module="")
            .values_list("module", flat=True).distinct().order_by("module")
        )
        actors = list(
            AuditLog.objects.exclude(actor_email="")
            .values_list("actor_email", flat=True).distinct().order_by("actor_email")
        )
        return Response({
            "actions": [{"value": v, "label": l} for v, l in AuditAction.choices],
            "modules": modules,
            "actors": actors,
        })
