from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    NotificationViewSet, ReminderViewSet, EmailLogViewSet,
    ProjectExpiryReminderViewSet, EmailConfigView, TestEmailView,
    SendCustomEmailView, TriggerRemindersView, AllUsersEmailsView,
)

router = DefaultRouter()
router.register('notifications', NotificationViewSet, basename='notification')
router.register('reminders', ReminderViewSet, basename='reminder')
router.register('email-logs', EmailLogViewSet, basename='email-log')
router.register('expiry-reminders', ProjectExpiryReminderViewSet, basename='expiry-reminder')

urlpatterns = router.urls + [
    path('email-config/', EmailConfigView.as_view(), name='email-config'),
    path('test-email/', TestEmailView.as_view(), name='test-email'),
    path('send-email/', SendCustomEmailView.as_view(), name='send-email'),
    path('trigger-reminders/', TriggerRemindersView.as_view(), name='trigger-reminders'),
    path('users-emails/', AllUsersEmailsView.as_view(), name='users-emails'),
]
