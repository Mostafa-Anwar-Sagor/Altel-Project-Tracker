from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .models import Notification, Reminder, EmailLog, EmailConfig, ProjectExpiryReminder
from .serializers import (
    NotificationSerializer, ReminderSerializer, EmailLogSerializer,
    EmailConfigSerializer, SendCustomEmailSerializer, ProjectExpiryReminderSerializer,
)
from apps.accounts.permissions import IsAdmin


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=['patch'])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({'status': 'all marked as read'})

    @action(detail=False, url_path='unread-count')
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})


class ReminderViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderSerializer

    def get_queryset(self):
        qs = Reminder.objects.all()
        project = self.request.query_params.get('project')
        if project:
            qs = qs.filter(project_id=project)
        return qs

    @action(detail=True, methods=['post'], url_path='send-now')
    def send_now(self, request, pk=None):
        reminder = self.get_object()
        from .tasks import send_reminder_notification
        send_reminder_notification.delay(str(reminder.id))
        return Response({'status': 'reminder queued'})


class EmailConfigView(APIView):
    """Admin-only: get and update SMTP configuration."""
    permission_classes = [IsAdmin]

    def get(self, request):
        config = EmailConfig.get_config()
        return Response(EmailConfigSerializer(config).data)

    def put(self, request):
        config = EmailConfig.get_config()
        serializer = EmailConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        # If password field not provided, keep old one
        if 'smtp_password' not in request.data:
            serializer.validated_data.pop('smtp_password', None)
        serializer.save()
        return Response(EmailConfigSerializer(config).data)


class TestEmailView(APIView):
    """Admin-only: send a test email to verify SMTP config."""
    permission_classes = [IsAdmin]

    def post(self, request):
        to_email = request.data.get('to_email')
        if not to_email:
            return Response({'error': 'to_email is required'}, status=status.HTTP_400_BAD_REQUEST)
        from .email_service import send_test_email
        success, error = send_test_email(to_email)
        if success:
            return Response({'status': 'Test email sent successfully'})
        return Response({'error': error or 'Failed to send test email'}, status=status.HTTP_400_BAD_REQUEST)


class SendCustomEmailView(APIView):
    """Admin-only: send a custom email to selected recipients."""
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = SendCustomEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .email_service import send_email
        success, error = send_email(
            serializer.validated_data['to_emails'],
            serializer.validated_data['subject'],
            serializer.validated_data['body'],
        )
        if success:
            return Response({'status': 'Email sent successfully'})
        return Response({'status': 'partial_failure', 'error': error}, status=status.HTTP_207_MULTI_STATUS)


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only: view email sending logs."""
    queryset = EmailLog.objects.all()
    serializer_class = EmailLogSerializer
    permission_classes = [IsAdmin]
    pagination_class = None


class TriggerRemindersView(APIView):
    """Admin-only: manually trigger the 4-stage project expiry reminder check."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from .tasks import check_project_expiry_reminders
        result = check_project_expiry_reminders()
        return Response({'status': 'Reminder check completed', 'result': result})


class ProjectExpiryReminderViewSet(viewsets.ReadOnlyModelViewSet):
    """View sent project expiry reminders."""
    queryset = ProjectExpiryReminder.objects.all()
    serializer_class = ProjectExpiryReminderSerializer
    permission_classes = [IsAdmin]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        project = self.request.query_params.get('project')
        if project:
            qs = qs.filter(project_id=project)
        return qs


class AllUsersEmailsView(APIView):
    """Admin-only: get all users with their emails for the email composer."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        users = User.objects.filter(is_active=True).values(
            'id', 'username', 'first_name', 'last_name', 'email', 'role', 'pillar'
        ).order_by('username')
        return Response(list(users))
