from rest_framework import viewsets, parsers
from .models import Attachment
from .serializers import AttachmentSerializer
from apps.comments.models import ActivityLog


class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get_queryset(self):
        qs = super().get_queryset()
        project = self.request.query_params.get('project')
        if project:
            qs = qs.filter(project_id=project)
        task = self.request.query_params.get('task')
        if task:
            qs = qs.filter(task_id=task)
        return qs

    def perform_create(self, serializer):
        attachment = serializer.save()
        if attachment.project:
            ActivityLog.objects.create(
                project=attachment.project,
                actor=self.request.user,
                action_type='FILE_UPLOADED',
                description=f'File "{attachment.file_name}" was uploaded'
            )
