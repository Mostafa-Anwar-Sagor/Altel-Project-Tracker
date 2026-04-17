import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('project_tracker')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Beat schedule for periodic tasks
app.conf.beat_schedule = {
    'check-project-deadlines': {
        'task': 'apps.notifications.tasks.check_project_deadlines',
        'schedule': crontab(minute=0),  # Every hour
    },
    'send-daily-digest': {
        'task': 'apps.notifications.tasks.send_daily_digest',
        'schedule': crontab(hour=8, minute=0),  # Every day at 8 AM
    },
    'check-overdue-tasks': {
        'task': 'apps.notifications.tasks.check_overdue_tasks',
        'schedule': crontab(minute='*/30'),  # Every 30 minutes
    },
    'take-daily-snapshots': {
        'task': 'apps.reports.tasks.take_daily_snapshots',
        'schedule': crontab(hour=0, minute=5),  # Every day at 00:05
    },
}
