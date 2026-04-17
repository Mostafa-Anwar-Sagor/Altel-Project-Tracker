import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Reminder(models.Model):
    class TriggerType(models.TextChoices):
        BEFORE_DEADLINE = 'BEFORE_DEADLINE', 'Before Deadline'
        SPECIFIC_DATE = 'SPECIFIC_DATE', 'Specific Date'
        RECURRING = 'RECURRING', 'Recurring'

    class Channel(models.TextChoices):
        EMAIL = 'EMAIL', 'Email'
        IN_APP = 'IN_APP', 'In App'
        BOTH = 'BOTH', 'Both'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, related_name='reminders')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_reminders')
    trigger_type = models.CharField(max_length=20, choices=TriggerType.choices, default=TriggerType.BEFORE_DEADLINE)
    days_before = models.IntegerField(default=7)
    remind_on = models.DateTimeField(null=True, blank=True)
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.BOTH)
    recipients = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='reminders')
    message = models.TextField(blank=True)
    is_sent = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Reminder for {self.project.title} - {self.days_before} days before"


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        DEADLINE_REMINDER = 'DEADLINE_REMINDER', 'Deadline Reminder'
        PROJECT_EXPIRED = 'PROJECT_EXPIRED', 'Project Expired'
        STATUS_CHANGED = 'STATUS_CHANGED', 'Status Changed'
        TASK_ASSIGNED = 'TASK_ASSIGNED', 'Task Assigned'
        COMMENT_MENTION = 'COMMENT_MENTION', 'Comment Mention'
        BUDGET_ALERT = 'BUDGET_ALERT', 'Budget Alert'
        MILESTONE_DUE = 'MILESTONE_DUE', 'Milestone Due'
        DAILY_DIGEST = 'DAILY_DIGEST', 'Daily Digest'
        MEMBER_ADDED = 'MEMBER_ADDED', 'Member Added'
        FILE_SHARED = 'FILE_SHARED', 'File Shared'
        APPROVAL_REQUIRED = 'APPROVAL_REQUIRED', 'Approval Required'
        TASK_COMPLETED = 'TASK_COMPLETED', 'Task Completed'
        OVERDUE_TASK = 'OVERDUE_TASK', 'Overdue Task'
        PROJECT_COMPLETED = 'PROJECT_COMPLETED', 'Project Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    task = models.ForeignKey('tasks.Task', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} → {self.recipient.username}"


class EmailLog(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SENT = 'SENT', 'Sent'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.subject} → {self.recipient_email}"


class EmailConfig(models.Model):
    """Singleton SMTP configuration that admin can update from the UI."""
    smtp_host = models.CharField(max_length=255, default='smtp.office365.com')
    smtp_port = models.IntegerField(default=587)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_user = models.EmailField(blank=True, default='')
    smtp_password = models.CharField(max_length=255, blank=True, default='')
    from_email = models.EmailField(default='noreply@projecttracker.local')
    display_name = models.CharField(max_length=100, default='ProTracker Notifications', blank=True)
    reply_to = models.EmailField(blank=True, default='')
    is_active = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Email Configuration'

    def __str__(self):
        return f"SMTP: {self.smtp_host}:{self.smtp_port}"

    def save(self, *args, **kwargs):
        self.pk = 1  # Singleton
        super().save(*args, **kwargs)

    @classmethod
    def get_config(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class ProjectExpiryReminder(models.Model):
    """Tracks which stage reminders have been sent for which project."""
    STAGE_CHOICES = [
        (4, '4 months before'),
        (3, '3 months before'),
        (2, '2 months before'),
        (1, '1 month before'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, related_name='expiry_reminders')
    stage = models.IntegerField(choices=STAGE_CHOICES, validators=[MinValueValidator(1), MaxValueValidator(4)])
    sent_at = models.DateTimeField(auto_now_add=True)
    recipients_json = models.JSONField(default=list)

    class Meta:
        unique_together = ['project', 'stage']
        ordering = ['-sent_at']

    def __str__(self):
        return f"{self.project.title} - Stage {self.stage}"
