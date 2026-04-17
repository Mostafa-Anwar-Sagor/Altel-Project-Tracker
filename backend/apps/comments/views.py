from rest_framework import viewsets, filters
from rest_framework.response import Response
from .models import Comment, ActivityLog
from .serializers import CommentSerializer, ActivityLogSerializer


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.filter(parent__isnull=True)
    serializer_class = CommentSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        project = self.request.query_params.get('project')
        if project:
            qs = qs.filter(project_id=project)
        task = self.request.query_params.get('task')
        if task:
            qs = qs.filter(task_id=task)
        return qs

    def perform_create(self, serializer):
        comment = serializer.save()
        if comment.project:
            ActivityLog.objects.create(
                project=comment.project, task=comment.task,
                actor=self.request.user,
                action_type='COMMENTED',
                description=f'{self.request.user.get_full_name() or self.request.user.username} commented'
            )
        # Notify mentioned users
        from apps.notifications.models import Notification
        for mention in comment.mentions.all():
            Notification.objects.create(
                recipient=mention.mentioned_user,
                title=f'You were mentioned in a comment',
                message=comment.content[:200],
                notification_type='COMMENT_MENTION',
                project=comment.project,
                task=comment.task,
                link=f'/projects/{comment.project_id}' if comment.project else ''
            )

    def perform_update(self, serializer):
        serializer.save(is_edited=True)


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        project = self.request.query_params.get('project')
        if project:
            qs = qs.filter(project_id=project)
        task = self.request.query_params.get('task')
        if task:
            qs = qs.filter(task_id=task)
        return qs
