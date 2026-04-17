from django.contrib import admin
from .models import Comment, ActivityLog, Mention

admin.site.register(Comment)
admin.site.register(ActivityLog)
admin.site.register(Mention)
