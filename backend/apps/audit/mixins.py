"""
apps/audit/mixins.py

AuditLogMixin — drop into any ModelViewSet to record create/update/delete as
audit-trail entries with before/after snapshots. Set `audit_module` on the
viewset for a friendly module label (otherwise the model's verbose name is
used).

It sits *in front of* other behaviour mixins (e.g. SoftDeleteViewSetMixin) in
the MRO and always calls super(), so the real create/update/soft-delete still
runs exactly as before — the audit write happens around it and can never block
it (log_action swallows its own errors).
"""
from .models import AuditAction
from .services import log_action, serialize_instance, diff_snapshots

# Field changes that should be classed as a role/permission change rather than
# a plain update (only present on the User model).
_PERMISSION_FIELDS = {"role", "is_active", "is_staff", "is_superuser"}


class AuditLogMixin:
    audit_module: str = ""
    # Optional per-viewset overrides for the recorded action. When unset, the
    # generic CREATE/UPDATE/DELETE actions are used. Marks/Attendance/Conduct
    # set these so a single-record edit reads the same as a bulk entry
    # ("Marks Entry" etc.).
    audit_create_action: str | None = None
    audit_update_action: str | None = None
    audit_delete_action: str | None = None

    def _audit_module(self) -> str:
        if self.audit_module:
            return self.audit_module
        try:
            return str(self.queryset.model._meta.verbose_name_plural).title()
        except Exception:
            return ""

    def perform_create(self, serializer):
        super().perform_create(serializer)
        instance = serializer.instance
        log_action(
            action=self.audit_create_action or AuditAction.CREATE,
            module=self._audit_module(),
            request=self.request,
            obj=instance,
            description=f"Created {self._audit_module()}: {instance}",
            new_value=serialize_instance(instance),
        )

    def perform_update(self, serializer):
        old_value = serialize_instance(serializer.instance) if serializer.instance else None
        super().perform_update(serializer)
        instance = serializer.instance
        new_value = serialize_instance(instance)
        diff_old, diff_new = diff_snapshots(old_value, new_value)

        action = self.audit_update_action or AuditAction.UPDATE
        if not self.audit_update_action and diff_new and _PERMISSION_FIELDS.intersection(diff_new.keys()):
            action = AuditAction.ROLE_PERMISSION_CHANGE

        log_action(
            action=action,
            module=self._audit_module(),
            request=self.request,
            obj=instance,
            description=f"Updated {self._audit_module()}: {instance}",
            old_value=diff_old,
            new_value=diff_new,
        )

    def perform_destroy(self, instance):
        old_value = serialize_instance(instance)
        object_id = str(getattr(instance, "pk", "") or "")
        object_name = str(instance)[:255]
        super().perform_destroy(instance)
        log_action(
            action=self.audit_delete_action or AuditAction.DELETE,
            module=self._audit_module(),
            request=self.request,
            object_id=object_id,
            object_name=object_name,
            description=f"Deleted {self._audit_module()}: {object_name}",
            old_value=old_value,
        )
