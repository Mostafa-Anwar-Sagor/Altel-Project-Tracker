from rest_framework import serializers
from .models import Task, TimeLog
from apps.accounts.serializers import UserMinimalSerializer


class TimeLogSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = TimeLog
        fields = ['id', 'task', 'user', 'hours_logged', 'date', 'description', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class TaskSerializer(serializers.ModelSerializer):
    assigned_to = UserMinimalSerializer(many=True, read_only=True)
    created_by = UserMinimalSerializer(read_only=True)
    logged_hours = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()
    subtasks_count = serializers.SerializerMethodField()
    subtasks_done = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'project', 'milestone', 'parent_task', 'title', 'description',
            'status', 'priority', 'assigned_to', 'created_by', 'start_date', 'due_date',
            'completed_at', 'estimated_hours', 'logged_hours', 'tags', 'order',
            'is_recurring', 'recurrence_rule', 'is_overdue', 'subtasks_count',
            'subtasks_done', 'comments_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'completed_at', 'created_at', 'updated_at']

    def get_subtasks_count(self, obj):
        return obj.subtasks.count()

    def get_subtasks_done(self, obj):
        return obj.subtasks.filter(status='DONE').count()

    def get_comments_count(self, obj):
        return obj.comments.count()


class TaskCreateUpdateSerializer(serializers.ModelSerializer):
    assigned_to_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, write_only=True
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )

    class Meta:
        model = Task
        fields = [
            'project', 'milestone', 'parent_task', 'title', 'description',
            'status', 'priority', 'start_date', 'due_date', 'estimated_hours',
            'order', 'is_recurring', 'recurrence_rule', 'assigned_to_ids', 'tag_ids'
        ]

    def create(self, validated_data):
        assigned_to_ids = validated_data.pop('assigned_to_ids', [])
        tag_ids = validated_data.pop('tag_ids', [])
        validated_data['created_by'] = self.context['request'].user
        task = Task.objects.create(**validated_data)
        if assigned_to_ids:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            task.assigned_to.set(User.objects.filter(id__in=assigned_to_ids))
        if tag_ids:
            from apps.projects.models import Tag
            task.tags.set(Tag.objects.filter(id__in=tag_ids))
        return task

    def update(self, instance, validated_data):
        assigned_to_ids = validated_data.pop('assigned_to_ids', None)
        tag_ids = validated_data.pop('tag_ids', None)

        # Track status change for activity
        old_status = instance.status

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if instance.status == 'DONE' and old_status != 'DONE':
            from django.utils import timezone
            instance.completed_at = timezone.now()
        elif instance.status != 'DONE':
            instance.completed_at = None

        instance.save()

        if assigned_to_ids is not None:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            instance.assigned_to.set(User.objects.filter(id__in=assigned_to_ids))
        if tag_ids is not None:
            from apps.projects.models import Tag
            instance.tags.set(Tag.objects.filter(id__in=tag_ids))
        return instance


class TaskBoardSerializer(serializers.ModelSerializer):
    """Lighter serializer for kanban board."""
    assigned_to = UserMinimalSerializer(many=True, read_only=True)
    is_overdue = serializers.ReadOnlyField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'status', 'priority', 'assigned_to',
            'due_date', 'order', 'is_overdue'
        ]
