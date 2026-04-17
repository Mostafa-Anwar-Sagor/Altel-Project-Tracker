from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, MilestoneViewSet, ProjectCategoryViewSet, TagViewSet, ProjectTemplateViewSet, PillarViewSet

router = DefaultRouter()
router.register('projects', ProjectViewSet)
router.register('categories', ProjectCategoryViewSet)
router.register('tags', TagViewSet)
router.register('templates', ProjectTemplateViewSet)
router.register('pillars', PillarViewSet)

urlpatterns = [
    path('projects/<uuid:project_pk>/milestones/', MilestoneViewSet.as_view({
        'get': 'list', 'post': 'create'
    })),
    path('projects/<uuid:project_pk>/milestones/<uuid:pk>/', MilestoneViewSet.as_view({
        'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'
    })),
    path('projects/<uuid:project_pk>/milestones/<uuid:pk>/complete/', MilestoneViewSet.as_view({
        'post': 'complete'
    })),
] + router.urls
