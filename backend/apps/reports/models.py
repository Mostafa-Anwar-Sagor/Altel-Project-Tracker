import uuid
from django.db import models
from django.conf import settings


class ProjectSnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, related_name='snapshots')
    date = models.DateField()
    progress_percent = models.IntegerField(default=0)
    tasks_total = models.IntegerField(default=0)
    tasks_done = models.IntegerField(default=0)
    tasks_overdue = models.IntegerField(default=0)
    budget_spent = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    logged_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['project', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"{self.project.title} - {self.date}"


class CalendarCustomEvent(models.Model):
    class EventType(models.TextChoices):
        MEETING = 'meeting', 'Meeting'
        DEADLINE = 'deadline', 'Deadline'
        REMINDER = 'reminder', 'Reminder'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    event_type = models.CharField(max_length=20, choices=EventType.choices, default=EventType.MEETING)
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    color = models.CharField(max_length=7, default='#06b6d4')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_events')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'start_time']

    def __str__(self):
        return f"{self.title} - {self.date}"


class DashboardWidgetConfig(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='widget_configs')
    widget_type = models.CharField(max_length=50)
    position = models.IntegerField(default=0)
    size = models.CharField(max_length=20, default='medium')
    config = models.JSONField(default=dict, blank=True)
    is_visible = models.BooleanField(default=True)

    class Meta:
        ordering = ['position']

    def __str__(self):
        return f"{self.user.username} - {self.widget_type}"
