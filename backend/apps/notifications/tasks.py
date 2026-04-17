from celery import shared_task
from django.utils import timezone
from django.conf import settings
from dateutil.relativedelta import relativedelta
import logging
import json

logger = logging.getLogger(__name__)


def _send_project_email(project, users, subject, body):
    """Helper to send generic email to a list of users for a project using DB-based SMTP."""
    from .email_service import send_email

    to_emails = [
        user.email for user in users
        if user.notification_email and user.email
    ]
    if to_emails:
        send_email(to_emails, subject, body)


def _get_project_recipients(project):
    """Get all relevant recipients for a project based on their roles."""
    recipients = set()
    recipients.add(project.owner)
    if project.manager:
        recipients.add(project.manager)
    for member in project.members.all():
        recipients.add(member.user)
    return list(recipients)


def check_project_expiry_reminders():
    """
    4-stage project expiry reminder system.
    Stages: 4 months, 3 months, 2 months, 1 month before end_date.
    Sends email & in-app notification. Tracks via ProjectExpiryReminder.
    Returns a summary dict.
    """
    from apps.projects.models import Project
    from apps.notifications.models import Notification, ProjectExpiryReminder

    today = timezone.now().date()
    stages = [
        (1, 4),  # stage 1 → 4 months before
        (2, 3),  # stage 2 → 3 months before
        (3, 2),  # stage 3 → 2 months before
        (4, 1),  # stage 4 → 1 month before
    ]

    active_projects = Project.objects.exclude(
        status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']
    ).filter(end_date__isnull=False)

    sent_count = 0
    skipped_count = 0

    for project in active_projects:
        for stage_num, months_before in stages:
            threshold_date = project.end_date - relativedelta(months=months_before)

            # Only send if we have reached or passed the threshold date
            if today < threshold_date:
                continue

            # Check if already sent for this stage
            already_sent = ProjectExpiryReminder.objects.filter(
                project=project, stage=stage_num
            ).exists()
            if already_sent:
                skipped_count += 1
                continue

            recipients = _get_project_recipients(project)
            months_left = months_before  # approximate months left

            # In-app notification
            for user in recipients:
                Notification.objects.create(
                    recipient=user,
                    title=f'Project Expiry Reminder (Stage {stage_num}): {project.title}',
                    message=(
                        f'Project "{project.title}" will expire in approximately {months_left} month{"s" if months_left != 1 else ""}. '
                        f'Deadline: {project.end_date}. Current progress: {project.progress_percent}%.'
                    ),
                    notification_type='DEADLINE_REMINDER',
                    project=project,
                    link=f'/projects/{project.id}',
                )

            # Email + Telegram – personalised per-user, role-based content
            from .email_service import send_project_reminder_email_to_user
            from .telegram_service import send_project_reminder_telegram

            for user in recipients:
                if getattr(user, 'notification_email', True) and user.email:
                    send_project_reminder_email_to_user(user, project, stage_num, months_before)
                if getattr(user, 'telegram_chat_id', ''):
                    send_project_reminder_telegram(user, project, stage_num, months_before)

            # Record reminder
            recipient_names = [u.get_full_name() or u.username for u in recipients]
            ProjectExpiryReminder.objects.create(
                project=project,
                stage=stage_num,
                sent_at=timezone.now(),
                recipients_json=json.dumps(recipient_names),
            )
            sent_count += 1
            logger.info(f'Sent stage {stage_num} reminder for project "{project.title}"')

    # Also auto-expire projects past deadline
    expired_projects = active_projects.filter(end_date__lt=today)
    for project in expired_projects:
        project.status = 'EXPIRED'
        project.save(update_fields=['status'])
        recipients = _get_project_recipients(project)
        for user in recipients:
            already = Notification.objects.filter(
                project=project, notification_type='PROJECT_EXPIRED',
                created_at__date=today
            ).exists()
            if not already:
                Notification.objects.create(
                    recipient=user,
                    title=f'Project Expired: {project.title}',
                    message=f'Project "{project.title}" has passed its deadline ({project.end_date}).',
                    notification_type='PROJECT_EXPIRED',
                    project=project,
                    link=f'/projects/{project.id}',
                )
        _send_project_email(
            project, recipients,
            f'[EXPIRED] Project "{project.title}" has expired',
            f'Project "{project.title}" deadline was {project.end_date}. The project is now marked as expired.'
        )

    return {'sent': sent_count, 'skipped': skipped_count, 'expired': expired_projects.count()}


@shared_task
def send_reminder_notification(reminder_id):
    """Send a specific reminder notification."""
    from apps.notifications.models import Reminder, Notification

    try:
        reminder = Reminder.objects.get(id=reminder_id)
    except Reminder.DoesNotExist:
        return

    if reminder.is_sent:
        return

    recipients = list(reminder.recipients.all())
    if not recipients:
        recipients = [reminder.project.owner]
        if reminder.project.manager:
            recipients.append(reminder.project.manager)

    message = reminder.message or f'Reminder: Project "{reminder.project.title}" deadline is approaching ({reminder.project.end_date}).'

    for user in recipients:
        Notification.objects.create(
            recipient=user,
            title=f'Reminder: {reminder.project.title}',
            message=message,
            notification_type='DEADLINE_REMINDER',
            project=reminder.project,
            link=f'/projects/{reminder.project.id}'
        )

    if reminder.channel in ['EMAIL', 'BOTH']:
        _send_project_email(
            reminder.project, recipients,
            f'[REMINDER] {reminder.project.title}',
            message
        )

    reminder.is_sent = True
    reminder.sent_at = timezone.now()
    reminder.save(update_fields=['is_sent', 'sent_at'])


@shared_task
def send_daily_digest():
    """Send daily digest email to all users."""
    from django.contrib.auth import get_user_model
    from apps.projects.models import Project
    from apps.tasks.models import Task
    from apps.notifications.models import Notification
    from .email_service import send_email

    User = get_user_model()
    today = timezone.now().date()
    week_later = today + timezone.timedelta(days=7)

    for user in User.objects.filter(is_approved=True, notification_email=True):
        member_projects = Project.objects.filter(
            members__user=user, end_date__gte=today, end_date__lte=week_later
        ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).order_by('end_date')

        overdue_tasks = Task.objects.filter(
            assigned_to=user, due_date__lt=today
        ).exclude(status__in=['DONE', 'CANCELLED'])

        tasks_today = Task.objects.filter(
            assigned_to=user, due_date=today
        ).exclude(status__in=['DONE', 'CANCELLED'])

        if not member_projects.exists() and not overdue_tasks.exists() and not tasks_today.exists():
            continue

        lines = [f'Good morning {user.get_full_name() or user.username},\n']
        lines.append('Here is your daily project summary:\n')

        if member_projects.exists():
            lines.append('-- Projects Expiring This Week --')
            for p in member_projects:
                days = (p.end_date - today).days
                lines.append(f'  • {p.title} — {days} day{"s" if days != 1 else ""} left (deadline: {p.end_date})')
            lines.append('')

        if tasks_today.exists():
            lines.append('-- Tasks Due Today --')
            for t in tasks_today:
                lines.append(f'  • {t.title} [{t.priority}] — {t.project.title}')
            lines.append('')

        if overdue_tasks.exists():
            lines.append('-- Overdue Tasks --')
            for t in overdue_tasks:
                lines.append(f'  • {t.title} (was due: {t.due_date}) — {t.project.title}')
            lines.append('')

        body = '\n'.join(lines)

        Notification.objects.create(
            recipient=user,
            title='Daily Digest',
            message=body[:500],
            notification_type='DAILY_DIGEST',
        )

        if user.email:
            send_email([user.email], '[Project Tracker] Your Daily Summary', body)


@shared_task
def check_overdue_tasks():
    """Check for overdue tasks and notify assignees."""
    from apps.tasks.models import Task
    from apps.notifications.models import Notification

    today = timezone.now().date()
    overdue_tasks = Task.objects.filter(
        due_date__lt=today
    ).exclude(status__in=['DONE', 'CANCELLED'])

    for task in overdue_tasks:
        for user in task.assigned_to.all():
            already_notified = Notification.objects.filter(
                recipient=user,
                task=task,
                notification_type='OVERDUE_TASK',
                created_at__gte=timezone.now() - timezone.timedelta(hours=24)
            ).exists()

            if not already_notified:
                days_overdue = (today - task.due_date).days
                Notification.objects.create(
                    recipient=user,
                    title=f'Overdue Task: {task.title}',
                    message=f'Task "{task.title}" is {days_overdue} day{"s" if days_overdue != 1 else ""} overdue (was due: {task.due_date}).',
                    notification_type='OVERDUE_TASK',
                    project=task.project,
                    task=task,
                    link=f'/projects/{task.project_id}'
                )


@shared_task
def send_notification_to_user(user_id, title, message, notification_type, project_id=None, task_id=None, link=''):
    """Generic task to create a notification for a user."""
    from apps.notifications.models import Notification
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    Notification.objects.create(
        recipient=user,
        title=title,
        message=message,
        notification_type=notification_type,
        project_id=project_id,
        task_id=task_id,
        link=link,
    )
