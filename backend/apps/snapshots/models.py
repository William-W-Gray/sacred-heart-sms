from django.db import models

from apps.trash.models import SoftDeleteModel


class Snapshot(SoftDeleteModel):
    """A JSON export of the school's data — admin-triggered, stored via the
    same media storage as everything else (R2 in prod, local disk in dev).
    Not a full database backup; a recoverable export of the data that
    actually matters if something goes badly wrong. Goes through Trash like
    everything else: soft-deleted first, the underlying file is only
    actually removed from storage on permanent delete.

    Restoring data FROM a snapshot back into the live DB is deliberately
    not exposed here — that's a much riskier operation than Trash-restore
    (it can overwrite or conflict with data created since the snapshot was
    taken). Download the file and restore manually via a management
    command when that's genuinely needed.
    """
    class SnapshotType(models.TextChoices):
        MANUAL      = "manual",     "Manual"
        SYSTEM      = "system",     "System"
        PRE_UPDATE  = "pre_update", "Pre-Update"
        PRE_DELETE  = "pre_delete", "Pre-Delete"

    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        FAILED    = "failed",    "Failed"

    name              = models.CharField(max_length=200, unique=True)
    description       = models.TextField(blank=True)
    snapshot_type     = models.CharField(max_length=20, choices=SnapshotType.choices, default=SnapshotType.MANUAL)
    included_modules  = models.JSONField(default=list)
    status            = models.CharField(max_length=20, choices=Status.choices, default=Status.COMPLETED)
    error_message     = models.TextField(blank=True)
    file              = models.FileField(upload_to="snapshots/", blank=True, null=True)
    size_bytes        = models.BigIntegerField(default=0)
    record_count      = models.IntegerField(default=0)
    created_by        = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, related_name="+")
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name

    def delete(self, *args, **kwargs):
        # FileField doesn't delete its underlying file on its own. Single-
        # instance .delete() is always a real delete regardless of which
        # manager fetched it (the soft-delete override only affects bulk
        # queryset .delete()), so this only ever runs from the actual
        # permanent-delete-from-Trash path, never from soft_delete().
        storage, path = (self.file.storage, self.file.name) if self.file else (None, None)
        super().delete(*args, **kwargs)
        if path:
            storage.delete(path)
