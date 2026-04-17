from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, DestroyAPIView
from django.utils import timezone
from django.db.models import Sum, Count, Q, F
from django.http import HttpResponse
from datetime import timedelta

from apps.projects.models import Project
from apps.tasks.models import Task, TimeLog
from apps.comments.models import ActivityLog
from .models import ProjectSnapshot
from .serializers import ProjectSnapshotSerializer


class OverviewReport(APIView):
    def get(self, request):
        projects = Project.objects.all()
        today = timezone.now().date()

        status_counts = {}
        for s in Project.Status.choices:
            status_counts[s[0].lower()] = projects.filter(status=s[0]).count()

        priority_counts = {}
        for p in Project.Priority.choices:
            priority_counts[p[0].lower()] = projects.filter(priority=p[0]).count()

        return Response({
            'total': projects.count(),
            'by_status': status_counts,
            'by_priority': priority_counts,
            'overdue': projects.filter(
                end_date__lt=today
            ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).count(),
        })


class ProgressTrendReport(APIView):
    def get(self, request):
        project_id = request.query_params.get('project')
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)

        qs = ProjectSnapshot.objects.filter(date__gte=start_date)
        if project_id:
            qs = qs.filter(project_id=project_id)

        return Response(ProjectSnapshotSerializer(qs, many=True).data)


class BudgetReport(APIView):
    def get(self, request):
        projects = Project.objects.exclude(status__in=['CANCELLED']).values(
            'id', 'title', 'budget_total', 'budget_spent', 'progress_percent', 'status'
        )

        data = []
        for p in projects:
            total = float(p['budget_total'] or 0)
            spent = float(p['budget_spent'] or 0)
            data.append({
                **p,
                'budget_total': total,
                'budget_spent': spent,
                'budget_remaining': total - spent,
                'budget_usage_pct': round((spent / total * 100), 1) if total > 0 else 0,
                'is_over_budget': spent > total,
            })

        return Response({
            'projects': data,
            'totals': {
                'total_budget': sum(d['budget_total'] for d in data),
                'total_spent': sum(d['budget_spent'] for d in data),
                'total_remaining': sum(d['budget_remaining'] for d in data),
            }
        })


class TimeTrackingReport(APIView):
    def get(self, request):
        project_id = request.query_params.get('project')
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)

        logs = TimeLog.objects.filter(date__gte=start_date)
        if project_id:
            logs = logs.filter(task__project_id=project_id)

        by_user = logs.values(
            'user__username', 'user__first_name', 'user__last_name'
        ).annotate(total_hours=Sum('hours_logged')).order_by('-total_hours')

        by_project = logs.values(
            'task__project__title', 'task__project__id'
        ).annotate(total_hours=Sum('hours_logged')).order_by('-total_hours')

        return Response({
            'by_user': list(by_user),
            'by_project': list(by_project),
            'total_hours': float(logs.aggregate(t=Sum('hours_logged'))['t'] or 0),
        })


class TeamProductivityReport(APIView):
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        users = User.objects.filter(is_approved=True)
        data = []
        for user in users:
            tasks_assigned = Task.objects.filter(assigned_to=user).count()
            tasks_completed = Task.objects.filter(
                assigned_to=user, status='DONE',
                completed_at__gte=start_date
            ).count()
            tasks_overdue = Task.objects.filter(
                assigned_to=user,
                due_date__lt=timezone.now().date()
            ).exclude(status__in=['DONE', 'CANCELLED']).count()
            hours = TimeLog.objects.filter(
                user=user, date__gte=start_date.date()
            ).aggregate(t=Sum('hours_logged'))['t'] or 0

            data.append({
                'user_id': str(user.id),
                'username': user.username,
                'full_name': user.get_full_name() or user.username,
                'tasks_assigned': tasks_assigned,
                'tasks_completed': tasks_completed,
                'tasks_overdue': tasks_overdue,
                'hours_logged': float(hours),
                'completion_rate': round((tasks_completed / tasks_assigned * 100), 1) if tasks_assigned > 0 else 0,
            })

        return Response(sorted(data, key=lambda x: x['tasks_completed'], reverse=True))


class UpcomingDeadlinesReport(APIView):
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        target = timezone.now().date() + timedelta(days=days)

        projects = Project.objects.filter(
            end_date__gte=timezone.now().date(),
            end_date__lte=target
        ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).order_by('end_date').values(
            'id', 'title', 'status', 'priority', 'end_date', 'progress_percent'
        )

        tasks = Task.objects.filter(
            due_date__gte=timezone.now().date(),
            due_date__lte=target
        ).exclude(status__in=['DONE', 'CANCELLED']).order_by('due_date').values(
            'id', 'title', 'status', 'priority', 'due_date', 'project__title'
        )

        milestones = []
        from apps.projects.models import Milestone
        ms = Milestone.objects.filter(
            due_date__gte=timezone.now().date(),
            due_date__lte=target
        ).exclude(status__in=['COMPLETED', 'CANCELLED']).order_by('due_date').values(
            'id', 'title', 'status', 'due_date', 'project__title'
        )

        return Response({
            'projects': list(projects),
            'tasks': list(tasks),
            'milestones': list(ms),
        })


class WorkloadReport(APIView):
    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        users = User.objects.filter(is_approved=True)
        data = []
        for user in users:
            active_tasks = Task.objects.filter(
                assigned_to=user
            ).exclude(status__in=['DONE', 'CANCELLED']).count()

            data.append({
                'user_id': str(user.id),
                'username': user.username,
                'full_name': user.get_full_name() or user.username,
                'active_tasks': active_tasks,
            })

        return Response(sorted(data, key=lambda x: x['active_tasks'], reverse=True))


class ExportReport(APIView):
    def post(self, request):
        format_type = request.data.get('format', 'excel')
        report_type = request.data.get('report_type', 'projects')

        if format_type == 'excel':
            return self._export_excel(report_type)
        return Response({'error': 'Unsupported format'}, status=status.HTTP_400_BAD_REQUEST)

    def _export_excel(self, report_type):
        import openpyxl
        from io import BytesIO

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Projects'

        headers = ['Title', 'Status', 'Priority', 'Start Date', 'End Date', 'Progress', 'Budget Total', 'Budget Spent']
        ws.append(headers)

        for col in range(1, len(headers) + 1):
            ws.cell(row=1, column=col).font = openpyxl.styles.Font(bold=True)

        projects = Project.objects.all().order_by('-created_at')
        for p in projects:
            ws.append([
                p.title, p.status, p.priority,
                str(p.start_date or ''), str(p.end_date or ''),
                p.progress_percent, float(p.budget_total), float(p.budget_spent)
            ])

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=project_report.xlsx'
        return response


class CalendarEventsView(APIView):
    def get(self, request):
        month = request.query_params.get('month')
        events = []

        project_qs = Project.objects.exclude(status__in=['CANCELLED'])
        task_qs = Task.objects.exclude(status__in=['CANCELLED'])

        dt = None
        if month:
            from datetime import datetime
            dt = datetime.strptime(month, '%Y-%m')
            project_qs = project_qs.filter(
                Q(start_date__year=dt.year, start_date__month=dt.month) |
                Q(end_date__year=dt.year, end_date__month=dt.month)
            )
            task_qs = task_qs.filter(due_date__year=dt.year, due_date__month=dt.month)

        for p in project_qs:
            if p.end_date:
                events.append({
                    'id': f'pe-{p.id}', 'title': f'Deadline: {p.title}',
                    'date': str(p.end_date), 'type': 'deadline',
                    'color': '#ef4444', 'project_id': str(p.id)
                })

        for t in task_qs:
            if t.due_date:
                events.append({
                    'id': f't-{t.id}', 'title': t.title,
                    'date': str(t.due_date), 'type': 'task',
                    'color': '#6366f1', 'project_id': str(t.project_id),
                    'task_id': str(t.id)
                })

        from apps.projects.models import Milestone
        milestones = Milestone.objects.exclude(status='CANCELLED')
        if dt:
            milestones = milestones.filter(due_date__year=dt.year, due_date__month=dt.month)
        for m in milestones:
            if m.due_date:
                events.append({
                    'id': f'm-{m.id}', 'title': f'Milestone: {m.title}',
                    'date': str(m.due_date), 'type': 'milestone',
                    'color': '#8b5cf6', 'project_id': str(m.project_id)
                })

        # Custom events (meetings, etc.)
        from .models import CalendarCustomEvent
        custom_qs = CalendarCustomEvent.objects.all()
        if dt:
            custom_qs = custom_qs.filter(date__year=dt.year, date__month=dt.month)
        for ce in custom_qs:
            events.append({
                'id': str(ce.id), 'title': ce.title,
                'date': str(ce.date), 'type': ce.event_type,
                'color': ce.color, 'description': ce.description,
                'start_time': str(ce.start_time) if ce.start_time else None,
                'end_time': str(ce.end_time) if ce.end_time else None,
                'is_custom': True,
            })

        return Response(events)


class CalendarCustomEventListCreate(ListCreateAPIView):
    from .models import CalendarCustomEvent
    from .serializers import CalendarCustomEventSerializer
    queryset = CalendarCustomEvent.objects.all()
    serializer_class = CalendarCustomEventSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CalendarCustomEventDelete(DestroyAPIView):
    from .models import CalendarCustomEvent
    queryset = CalendarCustomEvent.objects.all()
