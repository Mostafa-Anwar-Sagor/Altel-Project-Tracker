from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline]
    list_display = ['username', 'email', 'role', 'is_approved', 'is_staff', 'date_joined']
    list_filter = ['role', 'is_approved', 'is_staff']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Extra', {'fields': ('role', 'is_approved', 'avatar', 'phone', 'timezone', 'department', 'notification_email', 'notification_inapp')}),
    )
