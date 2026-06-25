"""
apps/trash/models.py

Shared soft-delete base for every model that should go to the Trash instead
of being permanently destroyed by a DELETE request. Models inherit
SoftDeleteModel and (optionally) override get_cascade_querysets() /
get_cascade_objects() to bring dependent records along when soft-deleted
and restored.

`objects` (the default manager) only ever returns non-deleted rows, so
every existing `Model.objects.filter(...)` call site — viewsets, services,
reverse FK relations — automatically excludes trashed rows with zero
changes needed at the call site. `all_objects` is the unfiltered manager,
used by the Trash API, cascades, and the lazy purge.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        """Bulk soft-delete via a queryset, e.g. Class.objects.filter(...).delete()."""
        return self.update(deleted_at=timezone.now())

    def hard_delete(self):
        return super().delete()


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(deleted_at__isnull=True)


class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    objects     = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    @property
    def is_trashed(self) -> bool:
        return self.deleted_at is not None

    def get_cascade_querysets(self) -> list[tuple[type, dict]]:
        """Dependent records to bulk soft-delete/restore alongside this one,
        e.g. a Student's marks — [(Mark, {"student": self}), ...]."""
        return []

    def get_cascade_objects(self) -> list["SoftDeleteModel"]:
        """Singular related SoftDeleteModel instances whose own
        soft_delete()/restore() should also run, so *their* cascades fire
        too — e.g. a User's attached Student/Teacher/Guardian profile."""
        return []

    def soft_delete(self, by=None, at=None) -> None:
        if self.deleted_at is not None:
            return
        now = at or timezone.now()
        self.deleted_at = now
        self.deleted_by = by
        self.save(update_fields=["deleted_at", "deleted_by"])
        for model_cls, filter_kwargs in self.get_cascade_querysets():
            model_cls.all_objects.filter(deleted_at__isnull=True, **filter_kwargs).update(deleted_at=now, deleted_by=by)
        for obj in self.get_cascade_objects():
            obj.soft_delete(by=by, at=now)

    def restore(self, at=None) -> None:
        if self.deleted_at is None:
            return
        was_deleted_at = at or self.deleted_at
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=["deleted_at", "deleted_by"])
        for model_cls, filter_kwargs in self.get_cascade_querysets():
            model_cls.all_objects.filter(deleted_at=was_deleted_at, **filter_kwargs).update(deleted_at=None, deleted_by=None)
        for obj in self.get_cascade_objects():
            if obj.deleted_at == was_deleted_at:
                obj.restore(at=was_deleted_at)
