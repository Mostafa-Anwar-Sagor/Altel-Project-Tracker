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

# Load initial data from fixture if DB is not yet populated with real users
echo "Checking if initial data fixture should be loaded..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
U = get_user_model()
admin = U.objects.filter(username='admin').first()
# Load fixture if: no users at all, OR only the temp admin (role=ACCOUNT_MANAGER) exists
should_load = (not admin) or (admin.role == 'ACCOUNT_MANAGER')
if should_load:
    print('Loading initial data from fixture...')
    U.objects.all().delete()
    from django.core.management import call_command
    call_command('loaddata', 'fixtures/initial_data.json')
    print('Fixture loaded successfully! All local users and data are now available.')
else:
    print('Data already loaded (admin role=' + admin.role + '), skipping fixture.')
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
