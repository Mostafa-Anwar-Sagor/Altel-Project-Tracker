from rest_framework import serializers
from .models import Notification, Reminder, EmailLog, EmailConfig, ProjectExpiryReminder, TelegramConfig, TelegramLog


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'title', 'message', 'notification_type',
            'project', 'task', 'link', 'is_read', 'read_at', 'created_at'
        ]
        read_only_fields = ['id', 'recipient', 'created_at']


class ReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reminder
        fields = [
            'id', 'project', 'created_by', 'trigger_type', 'days_before',
            'remind_on', 'channel', 'recipients', 'message',
            'is_sent', 'sent_at', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'is_sent', 'sent_at', 'created_at']

    def create(self, validated_data):
        recipients = validated_data.pop('recipients', [])
        validated_data['created_by'] = self.context['request'].user
        reminder = Reminder.objects.create(**validated_data)
        reminder.recipients.set(recipients)
        return reminder


class EmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailLog
        fields = ['id', 'recipient_email', 'subject', 'body', 'status', 'sent_at', 'error_message', 'created_at']


class EmailConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailConfig
        fields = [
            'smtp_host', 'smtp_port', 'smtp_use_tls', 'smtp_user', 'smtp_password',
            'from_email', 'display_name', 'reply_to', 'is_active', 'updated_at',
        ]
        read_only_fields = ['updated_at']
        extra_kwargs = {
            'smtp_password': {'write_only': True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['smtp_password_set'] = bool(instance.smtp_password)
        return data


class SendCustomEmailSerializer(serializers.Serializer):
    to_emails = serializers.ListField(child=serializers.EmailField(), min_length=1)
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField()


class ProjectExpiryReminderSerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = ProjectExpiryReminder
        fields = ['id', 'project', 'project_title', 'stage', 'sent_at', 'recipients_json']


class TelegramConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelegramConfig
        fields = ['bot_token', 'bot_username', 'is_active', 'updated_at']
        read_only_fields = ['updated_at']
        extra_kwargs = {
            'bot_token': {'write_only': True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['bot_token_set'] = bool(instance.bot_token)
        return data


class TelegramLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelegramLog
        fields = [
            'id', 'recipient_chat_id', 'recipient_name', 'message',
            'status', 'message_id', 'error_message', 'sent_at', 'created_at',
        ]


class TestTelegramSerializer(serializers.Serializer):
    chat_id = serializers.CharField(max_length=50, help_text='Telegram chat_id to send test to')


class SetWebhookSerializer(serializers.Serializer):
    webhook_url = serializers.URLField(help_text='Public HTTPS URL for the Telegram webhook')
