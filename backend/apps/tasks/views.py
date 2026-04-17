from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q

from .models import Task, TimeLog
from .serializers import TaskSerializer, TaskCreateUpdateSerializer, TaskBoardSerializer, TimeLogSerializer
from apps.comments.models import ActivityLog


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'due_date', 'priority', 'order', 'status']
    ordering = ['order', '-created_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateUpdateSerializer
        return TaskSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        project = params.get('project')
        if project:
            qs = qs.filter(project_id=project)

        milestone = params.get('milestone')
        if milestone:
            qs = qs.filter(milestone_id=milestone)

        statuses = params.get('status')
        if statuses:
            qs = qs.filter(status__in=statuses.split(','))

        priorities = params.get('priority')
        if priorities:
            qs = qs.filter(priority__in=priorities.split(','))

        assignee = params.get('assignee')
        if assignee:
            qs = qs.filter(assigned_to__id=assignee)

        if params.get('overdue') == 'true':
            qs = qs.filter(due_date__lt=timezone.now().date()).exclude(
                status__in=['DONE', 'CANCELLED']
            )

        parent_only = params.get('parent_only')
        if parent_only == 'true':
            qs = qs.filter(parent_task__isnull=True)

        return qs.distinct()

    def perform_create(self, serializer):
        task = serializer.save()
        ActivityLog.objects.create(
            project=task.project, task=task,
            actor=self.request.user,
            action_type='CREATED',
            description=f'Task "{task.title}" was created'
        )
        # Auto-update project progress
        self._update_project_progress(task.project)

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        task = serializer.save()

        if old_status != task.status:
            ActivityLog.objects.create(
                project=task.project, task=task,
                actor=self.request.user,
                action_type='STATUS_CHANGED',
                description=f'Task status changed from {old_status} to {task.status}',
                old_value={'status': old_status},
                new_value={'status': task.status}
            )
            if task.status == 'DONE':
                ActivityLog.objects.create(
                    project=task.project, task=task,
                    actor=self.request.user,
                    action_type='TASK_COMPLETED',
                    description=f'Task "{task.title}" was completed'
                )
        self._update_project_progress(task.project)

    def perform_destroy(self, instance):
        project = instance.project
        instance.delete()
        self._update_project_progress(project)

    def _update_project_progress(self, project):
        tasks = project.tasks.filter(parent_task__isnull=True)
        if tasks.exists():
            done = tasks.filter(status='DONE').count()
            project.progress_percent = round((done / tasks.count()) * 100)
            project.save(update_fields=['progress_percent'])

    @action(detail=False)
    def my(self, request):
        qs = Task.objects.filter(assigned_to=request.user).exclude(status__in=['DONE', 'CANCELLED'])
        return Response(TaskSerializer(qs, many=True).data)

    @action(detail=False)
    def overdue(self, request):
        qs = Task.objects.filter(
            due_date__lt=timezone.now().date()
        ).exclude(status__in=['DONE', 'CANCELLED'])
        return Response(TaskSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        task = self.get_object()
        user_ids = request.data.get('user_ids', [])
        from django.contrib.auth import get_user_model
        User = get_user_model()
        users = User.objects.filter(id__in=user_ids)
        task.assigned_to.set(users)
        for user in users:
            ActivityLog.objects.create(
                project=task.project, task=task,
                actor=request.user,
                action_type='TASK_ASSIGNED',
                description=f'{user.get_full_name() or user.username} was assigned to "{task.title}"'
            )
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=['post'], url_path='log-time')
    def log_time(self, request, pk=None):
        task = self.get_object()
        serializer = TimeLogSerializer(data={
            **request.data, 'task': task.id
        }, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, task=task)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True)
    def timelogs(self, request, pk=None):
        task = self.get_object()
        logs = task.time_logs.all()
        return Response(TimeLogSerializer(logs, many=True).data)

    @action(detail=False)
    def board(self, request):
        project_id = request.query_params.get('project')
        if not project_id:
            return Response({'error': 'project query param required'}, status=status.HTTP_400_BAD_REQUEST)
        tasks = Task.objects.filter(project_id=project_id, parent_task__isnull=True)
        return Response(TaskBoardSerializer(tasks, many=True).data)

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        items = request.data.get('items', [])
        for item in items:
            task_id = item.get('id')
            if not task_id:
                continue
            update_fields = {'order': item.get('order', 0)}
            if 'status' in item:
                update_fields['status'] = item['status']
            Task.objects.filter(id=task_id).update(**update_fields)
        return Response({'status': 'reordered'})
