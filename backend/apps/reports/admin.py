from django.contrib import admin
from .models import ProjectSnapshot, DashboardWidgetConfig

admin.site.register(ProjectSnapshot)
admin.site.register(DashboardWidgetConfig)
