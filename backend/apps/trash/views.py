"""
apps/trash/views.py
Admin-only API for browsing, restoring, and purging soft-deleted records
across every model registered in apps/trash/registry.py.

Auto-purge is lazy (checked on each request, not a scheduled job): any item
past RETENTION_DAYS is hard-deleted the next time anyone hits this API.
"""
from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.views import IsAdminUser
from . import registry

RETENTION_DAYS = 7


def _purge_expired() -> int:
    cutoff = timezone.now() - timedelta(days=RETENTION_DAYS)
    purged = 0
    for _slug, model_cls, _display_name, _label_field in registry.iter_registry():
        # Per-instance .delete(), not a bulk queryset .delete() — some
        # models (e.g. Snapshot) override .delete() to clean up side effects
        # like a stored file, and a bulk queryset delete bypasses that.
        for obj in list(model_cls.all_objects.filter(deleted_at__lt=cutoff)):
            obj.delete()
            purged += 1
    return purged


def _serialize(slug: str, display_name: str, label_field: str, obj) -> dict:
    label = str(obj) if label_field == "__str__" else str(getattr(obj, label_field, "") or str(obj))
    return {
        "type":            slug,
        "type_label":      display_name,
        "id":               obj.pk,
        "label":            label,
        "deleted_at":       obj.deleted_at,
        "deleted_by":       getattr(obj.deleted_by, "email", None),
        "expires_at":       obj.deleted_at + timedelta(days=RETENTION_DAYS),
        "days_remaining":   max(0, (obj.deleted_at + timedelta(days=RETENTION_DAYS) - timezone.now()).days),
    }


class TrashListView(APIView):
    """GET /api/trash/?type=<slug> — every trashed item, newest first."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        _purge_expired()
        type_filter = request.query_params.get("type")
        items = []
        for slug, model_cls, display_name, label_field in registry.iter_registry():
            if type_filter and slug != type_filter:
                continue
            qs = model_cls.all_objects.filter(deleted_at__isnull=False).order_by("-deleted_at")
            items.extend(_serialize(slug, display_name, label_field, obj) for obj in qs)
        items.sort(key=lambda i: i["deleted_at"], reverse=True)
        return Response({
            "count": len(items),
            "retention_days": RETENTION_DAYS,
            "results": items,
        })


def _get_trashed_object(type_, pk):
    model_cls = registry.get_model(type_)
    if model_cls is None:
        raise NotFound(f"Unknown trash type '{type_}'.")
    try:
        return model_cls.all_objects.get(pk=pk, deleted_at__isnull=False)
    except model_cls.DoesNotExist:
        raise NotFound("That item isn't in the trash (already restored, purged, or never existed).")


class TrashItemView(APIView):
    """DELETE /api/trash/<type>/<pk>/ — permanently delete now, instead of
    waiting for the retention window to expire."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def delete(self, request, type_, pk):
        obj = _get_trashed_object(type_, pk)
        obj.delete()  # all_objects is a plain Manager — this is a real hard delete
        return Response(status=204)


class TrashRestoreView(APIView):
    """POST /api/trash/<type>/<pk>/restore/"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, type_, pk):
        obj = _get_trashed_object(type_, pk)
        obj.restore()
        return Response({"detail": "Restored."})
