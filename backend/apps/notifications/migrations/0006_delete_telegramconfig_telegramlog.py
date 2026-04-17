from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0005_telegramconfig_telegramlog_delete_whatsappconfig_and_more'),
    ]

    operations = [
        migrations.DeleteModel(
            name='TelegramLog',
        ),
        migrations.DeleteModel(
            name='TelegramConfig',
        ),
    ]
