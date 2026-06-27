import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0004_feetype'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='fee_type_ref',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='invoices', to='finance.feetype'),
        ),
        migrations.AddField(
            model_name='invoice',
            name='fee_label',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
