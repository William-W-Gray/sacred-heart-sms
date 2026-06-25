"""
apps/audit/services.py

The single entry point for writing audit records: log_action(). Framework-
agnostic except for the optional `request` it reads ip/user-agent/actor from.

Hard rule: auditing must NEVER break the operation it's recording. Every
public function here swallows its own exceptions — a failed audit write logs a
warning and returns None, it never propagates up into the view.
"""
import datetime
import decimal
import logging
import uuid

from django.db import models

from .models import AuditLog, AuditAction

logger = logging.getLogger(__name__)

# Never copy these into old_value/new_value snapshots.
SENSITIVE_FIELDS = {"password", "token", "secret", "access", "refresh"}


def _json_safe(value):
    """Coerce a model field value into something JSONField can store."""
    if value is None or isinstance(value, (str, int, float, bool, dict, list)):
        return value
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return str(value)


def serialize_instance(instance) -> dict:
    """A flat, JSON-safe dict of a model instance's concrete local fields.
    FKs are recorded as `<field>_id`; sensitive fields are dropped."""
    data = {}
    try:
        for field in instance._meta.concrete_fields:
            name = field.name
            if name in SENSITIVE_FIELDS:
                continue
            if isinstance(field, models.ForeignKey):
                data[f"{name}_id"] = _json_safe(getattr(instance, f"{name}_id", None))
            else:
                data[name] = _json_safe(getattr(instance, name, None))
    except Exception:  # pragma: no cover - defensive
        logger.warning("audit: failed to serialize %r", instance, exc_info=True)
    return data


def diff_snapshots(old: dict | None, new: dict | None) -> tuple[dict | None, dict | None]:
    """Reduce a before/after pair to only the fields that actually changed, so
    an Update record's old_value/new_value stay compact and readable."""
    if not old or not new:
        return old, new
    changed_old, changed_new = {}, {}
    for key in set(old) | set(new):
        if old.get(key) != new.get(key):
            changed_old[key] = old.get(key)
            changed_new[key] = new.get(key)
    return (changed_old or None), (changed_new or None)


def _client_ip(request):
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(*, action: str, module: str = "", request=None, actor=None,
               obj=None, object_id=None, object_name=None, description: str = "",
               old_value=None, new_value=None) -> AuditLog | None:
    """Write one audit record. Safe to call from anywhere; never raises.

    `actor` defaults to request.user when a request is given. `obj` (a model
    instance) auto-fills object_id/object_name when those aren't passed.
    """
    try:
        if actor is None and request is not None:
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                actor = user

        if obj is not None:
            if object_id is None:
                object_id = str(getattr(obj, "pk", "") or "")
            if object_name is None:
                object_name = str(obj)[:255]

        actor_email = getattr(actor, "email", "") if actor else ""
        actor_role = getattr(actor, "role", "") if actor else ""

        return AuditLog.objects.create(
            actor=actor if actor and getattr(actor, "pk", None) else None,
            actor_email=actor_email or "",
            actor_role=actor_role or "",
            action=action,
            module=module or "",
            object_id=str(object_id or "")[:64],
            object_name=str(object_name or "")[:255],
            description=description or "",
            old_value=old_value,
            new_value=new_value,
            ip_address=_client_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT", "") if request else "")[:2000],
        )
    except Exception:  # pragma: no cover - auditing must never break the request
        logger.warning("audit: log_action failed (action=%s module=%s)", action, module, exc_info=True)
        return None


# Re-exported for convenience at call sites.
Action = AuditAction
