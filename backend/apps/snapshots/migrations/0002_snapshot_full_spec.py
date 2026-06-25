import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_blank_names(apps, schema_editor):
    Snapshot = apps.get_model("snapshots", "Snapshot")
    for snap in Snapshot.objects.filter(name=""):
        snap.name = f"snapshot-{snap.id}"
        snap.save(update_fields=["name"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("snapshots", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RenameField(
            model_name="snapshot",
            old_name="label",
            new_name="name",
        ),
        migrations.RunPython(backfill_blank_names, noop),
        migrations.AlterField(
            model_name="snapshot",
            name="name",
            field=models.CharField(max_length=200, unique=True),
        ),
        migrations.AlterField(
            model_name="snapshot",
            name="file",
            field=models.FileField(blank=True, null=True, upload_to="snapshots/"),
        ),
        migrations.AddField(
            model_name="snapshot",
            name="description",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="snapshot",
            name="snapshot_type",
            field=models.CharField(
                choices=[("manual", "Manual"), ("system", "System"), ("pre_update", "Pre-Update"), ("pre_delete", "Pre-Delete")],
                default="manual",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="snapshot",
            name="included_modules",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="snapshot",
            name="status",
            field=models.CharField(
                choices=[("completed", "Completed"), ("failed", "Failed")],
                default="completed",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="snapshot",
            name="error_message",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="snapshot",
            name="record_count",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="snapshot",
            name="deleted_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="snapshot",
            name="deleted_by",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
