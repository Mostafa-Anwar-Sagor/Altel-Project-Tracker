"""Utility to send real-time notifications via WebSocket."""
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def send_ws_notification(user_id, notification_data):
    """Push a notification to a user's WebSocket channel."""
    channel_layer = get_channel_layer()
    group_name = f'notifications_{user_id}'
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'new_notification',
            'notification': notification_data,
        }
    )


def send_ws_project_update(user_id, data):
    """Push a project update to a user's WebSocket channel."""
    channel_layer = get_channel_layer()
    group_name = f'notifications_{user_id}'
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'project_update',
            'data': data,
        }
    )
