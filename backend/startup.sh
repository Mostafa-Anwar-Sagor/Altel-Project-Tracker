#!/bin/bash
# Azure App Service startup script for ProTracker Django backend
set -e

echo "=== ProTracker Backend Startup ==="

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

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
