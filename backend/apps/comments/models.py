import uuid
from django.db import models
from django.conf import settings


class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, null=True, blank=True, related_name='comments')
    task = models.ForeignKey('tasks.Task', on_delete=models.CASCADE, null=True, blank=True, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments')
    content = models.TextField()
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    is_edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Comment by {self.author.username} at {self.created_at}"


class Mention(models.Model):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name='mentions')
    mentioned_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mentions')
    is_notified = models.BooleanField(default=False)

    class Meta:
        unique_together = ['comment', 'mentioned_user']


class ActivityLog(models.Model):
    class ActionType(models.TextChoices):
        CREATED = 'CREATED', 'Created'
        STATUS_CHANGED = 'STATUS_CHANGED', 'Status Changed'
        MEMBER_ADDED = 'MEMBER_ADDED', 'Member Added'
        MEMBER_REMOVED = 'MEMBER_REMOVED', 'Member Removed'
        DEADLINE_CHANGED = 'DEADLINE_CHANGED', 'Deadline Changed'
        COMMENTED = 'COMMENTED', 'Commented'
        FILE_UPLOADED = 'FILE_UPLOADED', 'File Uploaded'
        TASK_ASSIGNED = 'TASK_ASSIGNED', 'Task Assigned'
        MILESTONE_COMPLETED = 'MILESTONE_COMPLETED', 'Milestone Completed'
        BUDGET_UPDATED = 'BUDGET_UPDATED', 'Budget Updated'
        PRIORITY_CHANGED = 'PRIORITY_CHANGED', 'Priority Changed'
        TASK_COMPLETED = 'TASK_COMPLETED', 'Task Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, null=True, blank=True, related_name='activities')
    task = models.ForeignKey('tasks.Task', on_delete=models.CASCADE, null=True, blank=True, related_name='activities')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='activities')
    action_type = models.CharField(max_length=30, choices=ActionType.choices)
    description = models.TextField()
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'activity logs'

    def __str__(self):
        return f"{self.actor} - {self.action_type} - {self.created_at}"
