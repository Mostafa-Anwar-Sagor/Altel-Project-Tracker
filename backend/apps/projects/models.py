import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Pillar(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=7, default='#6366f1')

    def __str__(self):
        return self.name


class ProjectCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    color = models.CharField(max_length=7, default='#3b82f6')
    icon = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = 'project categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Project(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        ONGOING = 'ONGOING', 'Ongoing'
        ON_HOLD = 'ON_HOLD', 'On Hold'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        CRITICAL = 'CRITICAL', 'Critical'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True)
    pillar = models.CharField(max_length=100, blank=True, default='')
    client_name = models.CharField(max_length=255, blank=True, default='')
    project_manager = models.CharField(max_length=255, blank=True, default='')
    tcv = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Total Contract Value (RM)')
    custom_fields = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    category = models.ForeignKey(ProjectCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_projects')
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_projects')
    clients = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='client_projects')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    actual_completion_date = models.DateField(null=True, blank=True)
    estimated_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    progress_percent = models.IntegerField(default=0)
    is_public = models.BooleanField(default=False)
    color_label = models.CharField(max_length=7, default='#6366f1')
    cover_image = models.ImageField(upload_to='project_covers/', blank=True, null=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='projects')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_projects')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            base_slug = slugify(self.title)
            slug = base_slug
            n = 1
            while Project.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{n}"
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def days_until_deadline(self):
        if not self.end_date:
            return None
        return (self.end_date - timezone.now().date()).days

    @property
    def is_overdue(self):
        if not self.end_date:
            return False
        return self.end_date < timezone.now().date() and self.status not in [self.Status.COMPLETED, self.Status.CANCELLED, self.Status.EXPIRED]

    @property
    def logged_hours(self):
        from apps.tasks.models import TimeLog
        total = TimeLog.objects.filter(task__project=self).aggregate(total=models.Sum('hours_logged'))['total']
        return total or 0

    @property
    def health_score(self):
        score = 0

        # Completion health (50%) — primary driver: directly reflects progress
        score += self.progress_percent * 0.5

        # Schedule adherence (30%) — compares actual progress to time elapsed
        if self.start_date and self.end_date:
            total_days = max(1, (self.end_date - self.start_date).days)
            elapsed = max(0, (timezone.now().date() - self.start_date).days)
            time_pct = min(100, (elapsed / total_days) * 100)
            schedule_diff = self.progress_percent - time_pct
            # 50 = on schedule, >50 = ahead, <50 = behind
            schedule_score = max(0, min(100, 50 + schedule_diff))
            score += schedule_score * 0.3
        else:
            score += 50 * 0.3  # neutral when no dates set

        # Task quality (15%) — task completion rate with overdue penalty
        tasks = self.tasks.all()
        if tasks.exists():
            done = tasks.filter(status='DONE').count()
            overdue = tasks.filter(due_date__lt=timezone.now().date()).exclude(
                status__in=['DONE', 'CANCELLED']
            ).count()
            task_score = ((done / tasks.count()) * 100) - (overdue * 5)
            score += max(0, min(100, task_score)) * 0.15
        else:
            score += 50 * 0.15  # neutral when no tasks

        # Recent activity signal (5%)
        week_ago = timezone.now() - timezone.timedelta(days=7)
        recent_activities = self.activities.filter(created_at__gte=week_ago).count()
        score += min(100, recent_activities * 20) * 0.05

        return round(min(100, score))


class ProjectMember(models.Model):
    class RoleInProject(models.TextChoices):
        MANAGER = 'MANAGER', 'Manager'
        DEVELOPER = 'DEVELOPER', 'Developer'
        DESIGNER = 'DESIGNER', 'Designer'
        TESTER = 'TESTER', 'Tester'
        VIEWER = 'VIEWER', 'Viewer'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='project_memberships')
    role_in_project = models.CharField(max_length=20, choices=RoleInProject.choices, default=RoleInProject.DEVELOPER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['project', 'user']

    def __str__(self):
        return f"{self.user.username} - {self.project.title}"


class Milestone(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        MISSED = 'MISSED', 'Missed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    order = models.IntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'due_date']

    def __str__(self):
        return f"{self.project.title} - {self.title}"

    @property
    def progress_percent(self):
        tasks = self.tasks.all()
        if not tasks.exists():
            return 0
        done = tasks.filter(status='DONE').count()
        return round((done / tasks.count()) * 100)


class ProjectTemplate(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    default_milestones = models.JSONField(default=list, blank=True)
    default_tasks = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
