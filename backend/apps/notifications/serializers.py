from rest_framework import serializers
from .models import Notification, Reminder, EmailLog, EmailConfig, ProjectExpiryReminder


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
