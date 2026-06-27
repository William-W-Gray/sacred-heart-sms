from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_notification_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='photo',
            field=models.ImageField(blank=True, null=True, upload_to='users/photos/'),
        ),
        migrations.AddField(
            model_name='user',
            name='phone',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='user',
            name='address',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='user',
            name='notify_sound',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='notify_email',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='notify_in_app',
            field=models.BooleanField(default=True),
        ),
    ]
