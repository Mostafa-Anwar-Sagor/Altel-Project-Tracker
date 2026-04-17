import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.Model):
    class AccessLevel(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin – Full platform management'
        FULL_ACCESS = 'FULL_ACCESS', 'Full Access – All projects'
        PILLAR_BASED = 'PILLAR_BASED', 'Pillar Based – Projects by assigned pillar'
        OWN_ONLY = 'OWN_ONLY', 'Own Only – Own projects only'

    slug = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=100)
    access_level = models.CharField(max_length=20, choices=AccessLevel.choices, default=AccessLevel.OWN_ONLY)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=100, default='ACCOUNT_MANAGER')
    pillar = models.CharField(max_length=100, blank=True, default='')
    is_approved = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True)
    timezone = models.CharField(max_length=50, default='UTC')
    department = models.CharField(max_length=100, blank=True)
    notification_email = models.BooleanField(default=True)
    notification_inapp = models.BooleanField(default=True)

    class Meta:
        ordering = ['-date_joined']

    def __str__(self):
        return self.get_full_name() or self.username

    @property
    def access_level(self):
        try:
            r = Role.objects.get(slug=self.role)
            return r.access_level
        except Role.DoesNotExist:
            return 'OWN_ONLY'

    @property
    def role_display(self):
        try:
            return Role.objects.get(slug=self.role).name
        except Role.DoesNotExist:
            return self.role


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True)
    position = models.CharField(max_length=100, blank=True)
    skills = models.TextField(blank=True)
    working_hours_per_day = models.DecimalField(max_digits=4, decimal_places=2, default=8.0)

    def __str__(self):
        return f"Profile: {self.user.username}"
