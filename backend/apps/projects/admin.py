from django.contrib import admin
from .models import Project, ProjectMember, Milestone, ProjectCategory, Tag, ProjectTemplate


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 0


class MilestoneInline(admin.TabularInline):
    model = Milestone
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'priority', 'owner', 'start_date', 'end_date', 'progress_percent']
    list_filter = ['status', 'priority', 'category']
    search_fields = ['title', 'description']
    inlines = [ProjectMemberInline, MilestoneInline]


admin.site.register(ProjectCategory)
admin.site.register(Tag)
admin.site.register(ProjectTemplate)
