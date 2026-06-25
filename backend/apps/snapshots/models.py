from django.db import models


class Snapshot(models.Model):
    """A JSON export of the school's core data (students, teachers, marks,
    attendance, finance) — admin-triggered, stored via the same media
    storage as everything else (R2 in prod, local disk in dev). Not a full
    database backup; a recoverable export of the data that actually
    matters if something goes badly wrong."""
    label       = models.CharField(max_length=200, blank=True)
    file        = models.FileField(upload_to="snapshots/")
    size_bytes  = models.BigIntegerField(default=0)
    created_by  = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, related_name="+")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.label or f"Snapshot {self.created_at:%Y-%m-%d %H:%M}"

    def delete(self, *args, **kwargs):
        # FileField doesn't delete its underlying file on its own — without
        # this, every deleted snapshot leaves an orphaned file in storage
        # forever (R2 in prod, local disk in dev).
        storage, path = self.file.storage, self.file.name
        super().delete(*args, **kwargs)
        if path:
            storage.delete(path)
