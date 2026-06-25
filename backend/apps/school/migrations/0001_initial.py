import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SchoolProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('school_name', models.CharField(default='Sacred Heart Catholic High School', max_length=200)),
                ('logo', models.ImageField(blank=True, null=True, upload_to='school/')),
                ('address', models.CharField(blank=True, default='Monrovia, Liberia', max_length=255)),
                ('phone', models.CharField(blank=True, max_length=50)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('motto', models.CharField(blank=True, default='Ora et Labora', max_length=200)),
                ('principal_name', models.CharField(blank=True, max_length=150)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'School Profile',
                'verbose_name_plural': 'School Profile',
            },
        ),
    ]
