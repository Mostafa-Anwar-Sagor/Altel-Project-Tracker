from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q, Count, Sum
from django.contrib.auth import get_user_model

from .models import Project, ProjectMember, Milestone, ProjectCategory, Tag, ProjectTemplate, Pillar
from .serializers import (
    ProjectListSerializer, ProjectDetailSerializer, ProjectCreateUpdateSerializer,
    ProjectMemberSerializer, MilestoneSerializer, ProjectCategorySerializer,
    TagSerializer, ProjectTemplateSerializer, PillarSerializer
)
from apps.comments.models import ActivityLog

User = get_user_model()


class PillarViewSet(viewsets.ModelViewSet):
    queryset = Pillar.objects.all()
    serializer_class = PillarSerializer
    pagination_class = None


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'end_date', 'priority', 'status', 'progress_percent', 'title']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        if self.action == 'retrieve':
            return ProjectDetailSerializer
        return ProjectCreateUpdateSerializer

    def _apply_role_filter(self, qs):
        """Filter queryset based on user role."""
        user = self.request.user
        if user.is_superuser or user.access_level in ('ADMIN', 'FULL_ACCESS'):
            return qs
        if user.access_level == 'PILLAR_BASED':
            return qs.filter(pillar=user.pillar)
        # OWN_ONLY: own projects only
        return qs.filter(Q(owner=user) | Q(created_by=user))

    def get_queryset(self):
        qs = self._apply_role_filter(super().get_queryset())
        params = self.request.query_params

        # Filter by status
        statuses = params.get('status')
        if statuses:
            qs = qs.filter(status__in=statuses.split(','))

        # Filter by priority
        priorities = params.get('priority')
        if priorities:
            qs = qs.filter(priority__in=priorities.split(','))

        # Deadline filters
        deadline_before = params.get('deadline_before')
        if deadline_before:
            qs = qs.filter(end_date__lte=deadline_before)
        deadline_after = params.get('deadline_after')
        if deadline_after:
            qs = qs.filter(end_date__gte=deadline_after)

        # Overdue
        if params.get('overdue') == 'true':
            qs = qs.filter(
                end_date__lt=timezone.now().date()
            ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED'])

        # Expiring soon
        expiring_in_days = params.get('expiring_in_days')
        if expiring_in_days:
            days = int(expiring_in_days)
            target = timezone.now().date() + timezone.timedelta(days=days)
            qs = qs.filter(
                end_date__lte=target,
                end_date__gte=timezone.now().date()
            ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED'])

        # Filter by manager / member
        manager = params.get('manager')
        if manager:
            qs = qs.filter(manager_id=manager)
        member = params.get('member')
        if member:
            qs = qs.filter(members__user_id=member)

        # Category
        category = params.get('category')
        if category:
            qs = qs.filter(category_id=category)

        # Tag
        tag = params.get('tag')
        if tag:
            qs = qs.filter(tags__name=tag)

        # Pillar
        pillar = params.get('pillar')
        if pillar:
            qs = qs.filter(pillar=pillar)

        return qs.distinct()

    def perform_create(self, serializer):
        project = serializer.save()
        ActivityLog.objects.create(
            project=project,
            actor=self.request.user,
            action_type='CREATED',
            description=f'Project "{project.title}" was created'
        )

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        old_priority = serializer.instance.priority
        project = serializer.save()

        if old_status != project.status:
            ActivityLog.objects.create(
                project=project,
                actor=self.request.user,
                action_type='STATUS_CHANGED',
                description=f'Status changed from {old_status} to {project.status}',
                old_value={'status': old_status},
                new_value={'status': project.status}
            )
        if old_priority != project.priority:
            ActivityLog.objects.create(
                project=project,
                actor=self.request.user,
                action_type='PRIORITY_CHANGED',
                description=f'Priority changed from {old_priority} to {project.priority}',
                old_value={'priority': old_priority},
                new_value={'priority': project.priority}
            )

    @action(detail=False)
    def summary(self, request):
        qs = Project.objects.all()
        today = timezone.now().date()
        week_later = today + timezone.timedelta(days=7)

        data = {
            'total': qs.count(),
            'draft': qs.filter(status='DRAFT').count(),
            'ongoing': qs.filter(status='ONGOING').count(),
            'on_hold': qs.filter(status='ON_HOLD').count(),
            'completed': qs.filter(status='COMPLETED').count(),
            'cancelled': qs.filter(status='CANCELLED').count(),
            'expired': qs.filter(status='EXPIRED').count(),
            'overdue': qs.filter(end_date__lt=today).exclude(
                status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']
            ).count(),
            'expiring_this_week': qs.filter(
                end_date__gte=today, end_date__lte=week_later
            ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).count(),
            'total_budget': float(qs.aggregate(t=Sum('budget_total'))['t'] or 0),
            'total_spent': float(qs.aggregate(t=Sum('budget_spent'))['t'] or 0),
        }
        return Response(data)

    @action(detail=False)
    def overdue(self, request):
        qs = Project.objects.filter(
            end_date__lt=timezone.now().date()
        ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED'])
        return Response(ProjectListSerializer(qs, many=True).data)

    @action(detail=False, url_path='expiring-soon')
    def expiring_soon(self, request):
        days = int(request.query_params.get('days', 7))
        target = timezone.now().date() + timezone.timedelta(days=days)
        qs = Project.objects.filter(
            end_date__gte=timezone.now().date(),
            end_date__lte=target
        ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).order_by('end_date')
        return Response(ProjectListSerializer(qs, many=True).data)

    @action(detail=False)
    def my(self, request):
        qs = Project.objects.filter(
            Q(owner=request.user) |
            Q(manager=request.user) |
            Q(members__user=request.user)
        ).distinct()
        return Response(ProjectListSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'], url_path='members/add')
    def add_member(self, request, pk=None):
        project = self.get_object()
        user_id = request.data.get('user_id')
        role = request.data.get('role_in_project', 'DEVELOPER')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        member, created = ProjectMember.objects.get_or_create(
            project=project, user=user, defaults={'role_in_project': role}
        )
        if not created:
            return Response({'error': 'User is already a member'}, status=status.HTTP_400_BAD_REQUEST)

        ActivityLog.objects.create(
            project=project, actor=request.user,
            action_type='MEMBER_ADDED',
            description=f'{user.get_full_name() or user.username} was added to the project'
        )
        return Response(ProjectMemberSerializer(member).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='members/remove')
    def remove_member(self, request, pk=None):
        project = self.get_object()
        user_id = request.data.get('user_id')
        try:
            member = ProjectMember.objects.get(project=project, user_id=user_id)
            ActivityLog.objects.create(
                project=project, actor=request.user,
                action_type='MEMBER_REMOVED',
                description=f'{member.user.get_full_name() or member.user.username} was removed from the project'
            )
            member.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProjectMember.DoesNotExist:
            return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True)
    def activity(self, request, pk=None):
        project = self.get_object()
        activities = ActivityLog.objects.filter(project=project)[:50]
        from apps.comments.serializers import ActivityLogSerializer
        return Response(ActivityLogSerializer(activities, many=True).data)

    @action(detail=True)
    def health(self, request, pk=None):
        project = self.get_object()
        return Response({
            'score': project.health_score,
            'progress': project.progress_percent,
            'days_until_deadline': project.days_until_deadline,
            'is_overdue': project.is_overdue,
            'budget_usage': float(project.budget_spent / project.budget_total * 100) if project.budget_total > 0 else 0,
        })

    @action(detail=True)
    def timeline(self, request, pk=None):
        project = self.get_object()
        milestones = project.milestones.all()
        tasks = project.tasks.filter(parent_task__isnull=True)

        timeline_data = []
        for m in milestones:
            timeline_data.append({
                'id': str(m.id),
                'name': m.title,
                'start': str(project.start_date or timezone.now().date()),
                'end': str(m.due_date or project.end_date or timezone.now().date()),
                'progress': m.progress_percent,
                'type': 'milestone',
            })
        for t in tasks:
            timeline_data.append({
                'id': str(t.id),
                'name': t.title,
                'start': str(t.start_date or project.start_date or timezone.now().date()),
                'end': str(t.due_date or project.end_date or timezone.now().date()),
                'progress': 100 if t.status == 'DONE' else 50 if t.status == 'IN_PROGRESS' else 0,
                'type': 'task',
            })
        return Response(timeline_data)

    @action(detail=False, methods=['post'], url_path='from-template')
    def from_template(self, request):
        template_id = request.data.get('template_id')
        project_data = request.data.get('project', {})
        try:
            template = ProjectTemplate.objects.get(id=template_id)
        except ProjectTemplate.DoesNotExist:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ProjectCreateUpdateSerializer(data=project_data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        project = serializer.save()

        for ms_data in template.default_milestones:
            Milestone.objects.create(
                project=project, title=ms_data.get('title', ''),
                description=ms_data.get('description', ''),
                order=ms_data.get('order', 0),
                created_by=request.user
            )

        from apps.tasks.models import Task
        for task_data in (template.default_tasks or []):
            Task.objects.create(
                project=project,
                title=task_data.get('title', ''),
                description=task_data.get('description', ''),
                priority=task_data.get('priority', 'MEDIUM'),
                order=task_data.get('order', 0),
            )

        return Response(ProjectDetailSerializer(project).data, status=status.HTTP_201_CREATED)


class MilestoneViewSet(viewsets.ModelViewSet):
    serializer_class = MilestoneSerializer

    def get_queryset(self):
        return Milestone.objects.filter(project_id=self.kwargs.get('project_pk'))

    def perform_create(self, serializer):
        project = Project.objects.get(pk=self.kwargs['project_pk'])
        milestone = serializer.save(project=project, created_by=self.request.user)
        ActivityLog.objects.create(
            project=project, actor=self.request.user,
            action_type='CREATED',
            description=f'Milestone "{milestone.title}" was created'
        )

    @action(detail=True, methods=['post'])
    def complete(self, request, project_pk=None, pk=None):
        milestone = self.get_object()
        milestone.status = 'COMPLETED'
        milestone.completed_at = timezone.now()
        milestone.save()
        ActivityLog.objects.create(
            project=milestone.project, actor=request.user,
            action_type='MILESTONE_COMPLETED',
            description=f'Milestone "{milestone.title}" was completed'
        )
        return Response(MilestoneSerializer(milestone).data)


class ProjectCategoryViewSet(viewsets.ModelViewSet):
    queryset = ProjectCategory.objects.all()
    serializer_class = ProjectCategorySerializer


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer


class ProjectTemplateViewSet(viewsets.ModelViewSet):
    queryset = ProjectTemplate.objects.all()
    serializer_class = ProjectTemplateSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
