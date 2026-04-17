#!/bin/bash
# Azure App Service startup script for ProTracker Django backend
set -e

echo "=== ProTracker Backend Startup ==="

# Activate Oryx-built virtual environment if present
if [ -d "/antenv" ]; then
    echo "Activating /antenv virtual environment..."
    source /antenv/bin/activate
fi

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create default admin if no superuser exists
echo "Checking for superuser..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
U = get_user_model()
if not U.objects.filter(is_superuser=True).exists():
    u = U.objects.create_superuser('admin', 'admin@protracker.local', 'Admin@1234')
    u.is_approved = True
    u.save()
    print('Default admin created: username=admin password=Admin@1234')
else:
    print('Superuser already exists, skipping.')
"

# Start Gunicorn with Uvicorn workers (ASGI - required for Django Channels)
echo "Starting Gunicorn (ASGI)..."
exec gunicorn config.asgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 120 \
    --keep-alive 5 \
    --log-level info \
    --access-logfile -
