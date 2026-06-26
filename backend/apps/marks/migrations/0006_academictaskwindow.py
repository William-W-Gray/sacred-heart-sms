import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marks', '0005_assessmenttemplate'),
        ('students', '0004_academicyear_deleted_at_academicyear_deleted_by_and_more'),
        ('teachers', '0004_teacher_deleted_at_teacher_deleted_by_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AcademicTaskWindow',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('deleted_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('task_type', models.CharField(choices=[('attendance', 'Attendance'), ('assignment', 'Assignment / Homework'), ('quiz', 'Quiz Marks'), ('test', 'Test Marks'), ('exam', 'Exam Marks'), ('conduct', 'Conduct Entry'), ('report_comment', 'Report Card Comments')], db_index=True, max_length=20)),
                ('open_at', models.DateTimeField(blank=True, null=True)),
                ('close_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('auto', 'Automatic (by date/time)'), ('open', 'Open'), ('closed', 'Closed'), ('readonly', 'Read-Only')], default='auto', max_length=20)),
                ('note', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('academic_year', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='task_windows', to='students.academicyear')),
                ('assigned_class', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='task_windows', to='students.class')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('semester', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='task_windows', to='students.semester')),
                ('subject', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='task_windows', to='students.subject')),
                ('teacher', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='task_windows', to='teachers.teacher')),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
    ]
