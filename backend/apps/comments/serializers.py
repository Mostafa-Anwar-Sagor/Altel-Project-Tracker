from rest_framework import serializers
from .models import Comment, ActivityLog, Mention
from apps.accounts.serializers import UserMinimalSerializer


class MentionSerializer(serializers.ModelSerializer):
    mentioned_user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Mention
        fields = ['id', 'mentioned_user', 'is_notified']


class CommentSerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    mentions = MentionSerializer(many=True, read_only=True)

    class Meta:
        model = Comment
        fields = [
            'id', 'project', 'task', 'author', 'content', 'parent',
            'is_edited', 'replies', 'mentions', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'author', 'is_edited', 'created_at', 'updated_at']

    def get_replies(self, obj):
        if obj.parent is None:
            replies = obj.replies.all()[:10]
            return CommentSerializer(replies, many=True, context=self.context).data
        return []

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        comment = Comment.objects.create(**validated_data)
        self._process_mentions(comment)
        return comment

    def _process_mentions(self, comment):
        import re
        from django.contrib.auth import get_user_model
        User = get_user_model()
        pattern = r'@(\w+)'
        mentioned_usernames = re.findall(pattern, comment.content)
        for username in mentioned_usernames:
            try:
                user = User.objects.get(username=username)
                Mention.objects.get_or_create(comment=comment, mentioned_user=user)
            except User.DoesNotExist:
                pass


class ActivityLogSerializer(serializers.ModelSerializer):
    actor = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'project', 'task', 'actor', 'action_type',
            'description', 'old_value', 'new_value', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
