from celery import shared_task
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@shared_task
def take_daily_snapshots():
    """Take a daily snapshot of all active projects for trend tracking."""
    from apps.projects.models import Project
    from apps.tasks.models import Task
    from .models import ProjectSnapshot

    today = timezone.now().date()

    projects = Project.objects.exclude(status__in=['CANCELLED'])

    for project in projects:
        tasks = Task.objects.filter(project=project)
        tasks_total = tasks.count()
        tasks_done = tasks.filter(status='DONE').count()
        tasks_overdue = tasks.filter(
            due_date__lt=today
        ).exclude(status__in=['DONE', 'CANCELLED']).count()

        from django.db.models import Sum
        logged = tasks.aggregate(
            total=Sum('time_logs__hours_logged')
        )['total'] or 0

        ProjectSnapshot.objects.update_or_create(
            project=project,
            date=today,
            defaults={
                'progress_percent': project.progress_percent,
                'tasks_total': tasks_total,
                'tasks_done': tasks_done,
                'tasks_overdue': tasks_overdue,
                'budget_spent': project.budget_spent,
                'logged_hours': logged,
                'status': project.status,
            }
        )

    logger.info(f'Daily snapshots created for {projects.count()} projects')
