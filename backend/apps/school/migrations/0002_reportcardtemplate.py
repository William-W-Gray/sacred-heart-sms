import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('school', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ReportCardTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('header_line', models.CharField(blank=True, default='Republic of Liberia', max_length=120)),
                ('show_logo', models.BooleanField(default=True)),
                ('show_motto', models.BooleanField(default=True)),
                ('show_conduct', models.BooleanField(default=True)),
                ('show_attendance', models.BooleanField(default=True)),
                ('show_finance_balance', models.BooleanField(default=False)),
                ('show_grading_scale', models.BooleanField(default=True)),
                ('teacher_comment_label', models.CharField(blank=True, default="Class Teacher's Comment", max_length=80)),
                ('principal_comment_label', models.CharField(blank=True, default="Principal's Comment", max_length=80)),
                ('principal_signature', models.CharField(blank=True, max_length=120)),
                ('footer_text', models.CharField(blank=True, max_length=200)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Report Card Template',
                'verbose_name_plural': 'Report Card Template',
            },
        ),
    ]
