"""
management/commands/create_admin.py

Run: python manage.py create_admin

Creates the real administrator account from DJANGO_ADMIN_EMAIL /
DJANGO_ADMIN_PASSWORD env vars. Intended for hosts without shell access
(e.g. Render's free tier) -- runs on every deploy via docker-entrypoint.sh.

Idempotent: no-ops if either env var is unset, or if a user with that
email already exists (so it never resets a password you've since changed).
"""
import os

from django.core.management.base import BaseCommand

from apps.users.models import User


class Command(BaseCommand):
    help = "Create the admin superuser from DJANGO_ADMIN_EMAIL / DJANGO_ADMIN_PASSWORD env vars"

    def handle(self, *args, **options):
        email = os.environ.get("DJANGO_ADMIN_EMAIL")
        password = os.environ.get("DJANGO_ADMIN_PASSWORD")

        if not email or not password:
            self.stdout.write("DJANGO_ADMIN_EMAIL/DJANGO_ADMIN_PASSWORD not set, skipping admin creation")
            return

        if User.all_objects.filter(email__iexact=email).exists():
            self.stdout.write(f"User {email} already exists (active or trashed), skipping")
            return

        User.objects.create_superuser(email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"✅ Created admin user {email}"))
