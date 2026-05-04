from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum, Count, Q
from datetime import timedelta

from apps.projects.models import Project
from apps.tasks.models import Task
from apps.projects.serializers import ProjectListSerializer


class DashboardView(APIView):
    def _get_projects_for_user(self, user):
        """Return projects filtered by user role."""
        qs = Project.objects.all()
        if user.is_superuser or user.access_level in ('ADMIN', 'FULL_ACCESS'):
            return qs
        if user.access_level == 'PILLAR_BASED':
            return qs.filter(pillar=user.pillar)
        # OWN_ONLY
        from django.db.models import Q
        return qs.filter(Q(owner=user) | Q(created_by=user))

    def get(self, request):
        today = timezone.now().date()
        week_later = today + timedelta(days=7)

        projects = self._get_projects_for_user(request.user)

        # Summary counts
        summary = {
            'total_projects': projects.count(),
            'draft': projects.filter(status='DRAFT').count(),
            'ongoing': projects.filter(status='ONGOING').count(),
            'on_hold': projects.filter(status='ON_HOLD').count(),
            'completed': projects.filter(status='COMPLETED').count(),
            'cancelled': projects.filter(status='CANCELLED').count(),
            'expired': projects.filter(status='EXPIRED').count(),
        }

        # Alerts - real-time based on actual project dates
        overdue_projects = projects.filter(
            end_date__lt=today
        ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).order_by('end_date')

        urgent_projects = projects.filter(
            end_date__gte=today, end_date__lte=today + timedelta(days=2)
        ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).order_by('end_date')

        expiring_soon = projects.filter(
            end_date__gt=today + timedelta(days=2), end_date__lte=week_later
        ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).order_by('end_date')

        overdue_tasks = Task.objects.filter(
            due_date__lt=today
        ).exclude(status__in=['DONE', 'CANCELLED'])

        # Recent activity
        from apps.comments.models import ActivityLog
        recent_activity = ActivityLog.objects.all()[:10]
        from apps.comments.serializers import ActivityLogSerializer

        # My tasks due today
        my_tasks_today = Task.objects.filter(
            assigned_to=request.user, due_date=today
        ).exclude(status__in=['DONE', 'CANCELLED'])

        # TCV overview
        budget_data = projects.exclude(status='CANCELLED').aggregate(
            total_tcv=Sum('tcv'),
        )
        projects_with_tcv = projects.exclude(status='CANCELLED').filter(tcv__isnull=False).count()

        # TCV by year — multi-year bar chart (all years with data + current year always)
        from decimal import Decimal
        from django.db.models.functions import ExtractYear

        year_agg = (
            projects.filter(tcv__isnull=False, start_date__isnull=False)
            .annotate(yr=ExtractYear('start_date'))
            .values('yr')
            .annotate(total=Sum('tcv'))
            .order_by('yr')
        )
        years_with_data = {int(row['yr']): float(row['total'] or 0) for row in year_agg}
        # Always include last 5 years for context
        current_year = today.year
        year_range = range(max(current_year - 4, min(years_with_data.keys(), default=current_year)), current_year + 1)
        tcv_by_year = [{'year': str(y), 'tcv': years_with_data.get(y, 0)} for y in year_range]

        # TCV by pillar for dashboard
        from django.db.models import Sum as DSum
        tcv_by_pillar = []
        pillar_agg = projects.exclude(status='CANCELLED').filter(
            tcv__isnull=False, pillar__isnull=False
        ).values('pillar').annotate(total=DSum('tcv')).order_by('-total')
        for row in pillar_agg:
            tcv_by_pillar.append({'pillar': row['pillar'], 'tcv': float(row['total'] or 0)})

        # Status distribution for chart
        status_chart = []
        for s in Project.Status.choices:
            count = projects.filter(status=s[0]).count()
            if count > 0:
                status_chart.append({'name': s[1], 'value': count, 'key': s[0]})

        # Priority distribution
        priority_chart = []
        for p in Project.Priority.choices:
            count = projects.filter(priority=p[0]).count()
            if count > 0:
                priority_chart.append({'name': p[1], 'value': count, 'key': p[0]})

        # Top 5 projects by progress
        top_projects = projects.exclude(
            status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']
        ).order_by('-progress_percent')[:5]

        # Monthly completed (last 6 months)
        monthly_completed = []
        for i in range(5, -1, -1):
            y = today.year
            m = today.month - i
            while m <= 0:
                m += 12
                y -= 1
            month_start = today.replace(year=y, month=m, day=1)
            if m == 12:
                month_end = month_start.replace(year=y + 1, month=1)
            else:
                month_end = month_start.replace(month=m + 1)
            count = projects.filter(
                status='COMPLETED',
                actual_completion_date__gte=month_start,
                actual_completion_date__lt=month_end
            ).count()
            monthly_completed.append({
                'month': month_start.strftime('%b %Y'),
                'completed': count,
            })

        # Build detailed alert items with severity
        alert_items = []

        for p in overdue_projects:
            days_overdue = (today - p.end_date).days
            alert_items.append({
                'id': str(p.id),
                'title': p.title,
                'severity': 'critical',
                'type': 'overdue',
                'message': f'Overdue by {days_overdue} day{"s" if days_overdue != 1 else ""}',
                'end_date': str(p.end_date),
                'status': p.status,
                'progress': p.progress_percent,
            })

        for p in urgent_projects:
            days_left = (p.end_date - today).days
            alert_items.append({
                'id': str(p.id),
                'title': p.title,
                'severity': 'urgent',
                'type': 'urgent',
                'message': f'Due in {days_left} day{"s" if days_left != 1 else ""} — complete NOW!' if days_left > 0 else 'Due TODAY!',
                'end_date': str(p.end_date),
                'status': p.status,
                'progress': p.progress_percent,
            })

        for p in expiring_soon:
            days_left = (p.end_date - today).days
            alert_items.append({
                'id': str(p.id),
                'title': p.title,
                'severity': 'warning',
                'type': 'expiring',
                'message': f'Due in {days_left} day{"s" if days_left != 1 else ""}',
                'end_date': str(p.end_date),
                'status': p.status,
                'progress': p.progress_percent,
            })

        return Response({
            'summary': summary,
            'alerts': {
                'items': alert_items,
                'overdue_projects_count': overdue_projects.count(),
                'urgent_projects_count': urgent_projects.count(),
                'expiring_soon_count': expiring_soon.count(),
                'overdue_tasks_count': overdue_tasks.count(),
            },
            'my_tasks_today': [
                {'id': str(t.id), 'title': t.title, 'priority': t.priority, 'project': t.project.title}
                for t in my_tasks_today
            ],
            'budget': {
                'total': float(budget_data['total_tcv'] or 0),
                'spent': 0,
                'projects_with_tcv': projects_with_tcv,
                'total_projects': projects.count(),
            },
            'charts': {
                'status_distribution': status_chart,
                'priority_distribution': priority_chart,
                'monthly_completed': monthly_completed,
                'tcv_by_year': tcv_by_year,
                'tcv_by_pillar': tcv_by_pillar,
            },
            'top_projects': ProjectListSerializer(top_projects, many=True).data,
            'recent_activity': ActivityLogSerializer(recent_activity, many=True).data,
        })
