from django.contrib import admin
from .models import Notification, Reminder, EmailLog


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'recipient', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read']


admin.site.register(Reminder)
admin.site.register(EmailLog)
