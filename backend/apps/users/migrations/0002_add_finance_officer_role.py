from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Administrator"),
                    ("finance_officer", "Finance Officer"),
                    ("teacher", "Teacher"),
                    ("student", "Student"),
                    ("guardian", "Guardian"),
                ],
                default="student",
                max_length=20,
            ),
        ),
    ]
