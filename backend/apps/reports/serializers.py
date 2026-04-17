from rest_framework import serializers
from .models import ProjectSnapshot, CalendarCustomEvent


class ProjectSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectSnapshot
        fields = [
            'id', 'project', 'date', 'progress_percent', 'tasks_total',
            'tasks_done', 'tasks_overdue', 'budget_spent', 'logged_hours',
            'status', 'created_at'
        ]


class CalendarCustomEventSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CalendarCustomEvent
        fields = [
            'id', 'title', 'description', 'event_type', 'date',
            'start_time', 'end_time', 'color', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username
