from rest_framework import serializers
from .models import Attachment


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = [
            'id', 'project', 'task', 'uploaded_by', 'uploaded_by_name',
            'file', 'file_name', 'file_size', 'file_type', 'created_at'
        ]
        read_only_fields = ['id', 'uploaded_by', 'file_name', 'file_size', 'created_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None

    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        file_obj = validated_data.get('file')
        if file_obj:
            validated_data['file_name'] = file_obj.name
            validated_data['file_type'] = file_obj.content_type or ''
        return super().create(validated_data)
