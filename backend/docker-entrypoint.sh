#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py seed_essentials

exec gunicorn config.wsgi:application --bind 0.0.0.0:"$PORT" --workers 4 --timeout 120 --access-logfile -
