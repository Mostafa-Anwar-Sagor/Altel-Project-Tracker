from django.contrib import admin
from .models import Task, TimeLog


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'status', 'priority', 'due_date', 'created_at']
    list_filter = ['status', 'priority']
    search_fields = ['title', 'description']


admin.site.register(TimeLog)
