from rest_framework import serializers
from django.conf import settings
from .models import Project, ProjectMember, Milestone, ProjectCategory, Tag, ProjectTemplate, Pillar
from apps.accounts.serializers import UserMinimalSerializer


class PillarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pillar
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'color']


class ProjectCategorySerializer(serializers.ModelSerializer):
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectCategory
        fields = ['id', 'name', 'color', 'icon', 'description', 'project_count']

    def get_project_count(self, obj):
        return obj.projects.count()


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = ProjectMember
        fields = ['id', 'user', 'user_id', 'role_in_project', 'joined_at']
        read_only_fields = ['id', 'joined_at']


class MilestoneSerializer(serializers.ModelSerializer):
    progress_percent = serializers.ReadOnlyField()
    tasks_count = serializers.SerializerMethodField()
    created_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Milestone
        fields = [
            'id', 'project', 'title', 'description', 'due_date', 'completed_at',
            'status', 'order', 'created_by', 'created_at', 'progress_percent', 'tasks_count'
        ]
        read_only_fields = ['id', 'created_at', 'completed_at']

    def get_tasks_count(self, obj):
        return obj.tasks.count()


class ProjectListSerializer(serializers.ModelSerializer):
    owner = UserMinimalSerializer(read_only=True)
    manager = UserMinimalSerializer(read_only=True)
    category = ProjectCategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    days_until_deadline = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()
    health_score = serializers.ReadOnlyField()
    logged_hours = serializers.ReadOnlyField()
    tasks_count = serializers.SerializerMethodField()
    tasks_done = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'title', 'slug', 'description', 'status', 'priority',
            'pillar', 'client_name', 'contact_person', 'contact_tel',
            'custom_fields',
            'category', 'owner', 'manager', 'start_date', 'end_date',
            'progress_percent', 'budget_total', 'budget_spent', 'estimated_hours',
            'logged_hours', 'is_public', 'color_label', 'tags', 'days_until_deadline',
            'is_overdue', 'health_score', 'tasks_count', 'tasks_done', 'member_count',
            'created_at', 'updated_at'
        ]

    def get_tasks_count(self, obj):
        return obj.tasks.count()

    def get_tasks_done(self, obj):
        return obj.tasks.filter(status='DONE').count()

    def get_member_count(self, obj):
        return obj.members.count()


class ProjectDetailSerializer(serializers.ModelSerializer):
    owner = UserMinimalSerializer(read_only=True)
    manager = UserMinimalSerializer(read_only=True)
    category = ProjectCategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    members = ProjectMemberSerializer(many=True, read_only=True)
    milestones = MilestoneSerializer(many=True, read_only=True)
    days_until_deadline = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()
    health_score = serializers.ReadOnlyField()
    logged_hours = serializers.ReadOnlyField()
    tasks_count = serializers.SerializerMethodField()
    tasks_done = serializers.SerializerMethodField()
    created_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'title', 'slug', 'description', 'status', 'priority',
            'pillar', 'client_name', 'contact_person', 'contact_tel',
            'custom_fields',
            'category', 'owner', 'manager', 'members', 'milestones',
            'start_date', 'end_date', 'actual_completion_date',
            'estimated_hours', 'logged_hours', 'budget_total', 'budget_spent',
            'progress_percent', 'is_public', 'color_label', 'cover_image',
            'tags', 'days_until_deadline', 'is_overdue', 'health_score',
            'tasks_count', 'tasks_done', 'created_by', 'created_at', 'updated_at'
        ]

    def get_tasks_count(self, obj):
        return obj.tasks.count()

    def get_tasks_done(self, obj):
        return obj.tasks.filter(status='DONE').count()


class ProjectCreateUpdateSerializer(serializers.ModelSerializer):
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Tag.objects.all(), required=False, source='tags'
    )
    manager_id = serializers.UUIDField(required=False, allow_null=True)
    category_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Project
        fields = [
            'title', 'description', 'status', 'priority',
            'pillar', 'client_name', 'contact_person', 'contact_tel',
            'custom_fields',
            'category_id', 'manager_id', 'start_date', 'end_date',
            'estimated_hours', 'budget_total', 'budget_spent',
            'progress_percent', 'is_public', 'color_label', 'cover_image', 'tag_ids'
        ]

    def create(self, validated_data):
        tags = validated_data.pop('tags', [])
        manager_id = validated_data.pop('manager_id', None)
        category_id = validated_data.pop('category_id', None)

        if manager_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                validated_data['manager'] = User.objects.get(id=manager_id)
            except User.DoesNotExist:
                raise serializers.ValidationError({'manager_id': 'User not found'})
        if category_id:
            try:
                validated_data['category'] = ProjectCategory.objects.get(id=category_id)
            except ProjectCategory.DoesNotExist:
                raise serializers.ValidationError({'category_id': 'Category not found'})

        user = self.context['request'].user
        validated_data['owner'] = user
        validated_data['created_by'] = user

        project = Project.objects.create(**validated_data)
        project.tags.set(tags)
        ProjectMember.objects.create(project=project, user=user, role_in_project='MANAGER')
        return project

    def update(self, instance, validated_data):
        tags = validated_data.pop('tags', None)
        manager_id = validated_data.pop('manager_id', None)
        category_id = validated_data.pop('category_id', None)

        if manager_id is not None:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            if manager_id:
                try:
                    instance.manager = User.objects.get(id=manager_id)
                except User.DoesNotExist:
                    raise serializers.ValidationError({'manager_id': 'User not found'})
            else:
                instance.manager = None
        if category_id is not None:
            if category_id:
                try:
                    instance.category = ProjectCategory.objects.get(id=category_id)
                except ProjectCategory.DoesNotExist:
                    raise serializers.ValidationError({'category_id': 'Category not found'})
            else:
                instance.category = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if tags is not None:
            instance.tags.set(tags)
        return instance


class ProjectTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectTemplate
        fields = ['id', 'name', 'description', 'default_milestones', 'default_tasks', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']
