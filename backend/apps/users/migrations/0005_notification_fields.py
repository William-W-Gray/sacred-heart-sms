from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_deleted_at_user_deleted_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='priority',
            field=models.CharField(choices=[('low', 'Low'), ('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')], db_index=True, default='normal', max_length=10),
        ),
        migrations.AddField(
            model_name='notification',
            name='recipient_role',
            field=models.CharField(blank=True, db_index=True, max_length=30),
        ),
        migrations.AddField(
            model_name='notification',
            name='module',
            field=models.CharField(blank=True, db_index=True, max_length=50),
        ),
        migrations.AddField(
            model_name='notification',
            name='action_type',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='notification',
            name='related_object_id',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['recipient', 'is_read'], name='users_notif_recipie_idx'),
        ),
    ]
