from rest_framework.routers import DefaultRouter
from .views import CommentViewSet, ActivityLogViewSet

router = DefaultRouter()
router.register('comments', CommentViewSet)
router.register('activities', ActivityLogViewSet)

urlpatterns = router.urls
