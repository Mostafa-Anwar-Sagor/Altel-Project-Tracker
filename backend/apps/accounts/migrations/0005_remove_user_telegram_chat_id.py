from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_telegram_chat_id'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='telegram_chat_id',
        ),
    ]
