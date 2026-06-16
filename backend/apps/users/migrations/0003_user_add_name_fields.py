from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_add_finance_officer_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="first_name",
            field=models.CharField(blank=True, default="", max_length=100),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="user",
            name="last_name",
            field=models.CharField(blank=True, default="", max_length=100),
            preserve_default=False,
        ),
    ]
