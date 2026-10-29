from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("mail", "0001_initial")]
    operations = [
        migrations.AddField(
            model_name="delivery",
            name="coalesce_key",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="delivery",
            name="recipient_key",
            field=models.CharField(blank=True, default="", max_length=64, db_index=True),
        ),
        migrations.AddField(
            model_name="delivery",
            name="origin",
            field=models.CharField(blank=True, default="", max_length=64, db_index=True),
        ),
        migrations.AddField(
            model_name="delivery",
            name="purpose",
            field=models.CharField(default="security", max_length=16, db_index=True),
        ),
        migrations.AlterField(
            model_name="delivery",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
    ]
