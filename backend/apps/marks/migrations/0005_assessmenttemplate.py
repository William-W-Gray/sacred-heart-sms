import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marks', '0004_conductcategory_deleted_at_and_more'),
        ('students', '0004_academicyear_deleted_at_academicyear_deleted_by_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AssessmentTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('deleted_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('name', models.CharField(max_length=100)),
                ('kind', models.CharField(choices=[('assignment', 'Assignment / Homework'), ('quiz', 'Quiz'), ('test', 'Test'), ('exam', 'Exam')], default='test', max_length=20)),
                ('max_score', models.DecimalField(decimal_places=2, default=100, max_digits=6, validators=[django.core.validators.MinValueValidator(0)])),
                ('weight', models.DecimalField(decimal_places=2, default=0, help_text='Contribution to the subject total, as a percentage.', max_digits=5, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)])),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('academic_year', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assessment_templates', to='students.academicyear')),
                ('class_group', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='assessment_templates', to='students.class')),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('semester', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='assessment_templates', to='students.semester')),
                ('subject', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='assessment_templates', to='students.subject')),
            ],
            options={
                'ordering': ['sort_order', 'kind', 'name'],
            },
        ),
    ]
