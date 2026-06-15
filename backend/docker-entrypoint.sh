#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py seed_essentials
python manage.py create_admin

exec gunicorn config.wsgi:application --bind 0.0.0.0:"$PORT" --workers 4 --timeout 120 --access-logfile -
