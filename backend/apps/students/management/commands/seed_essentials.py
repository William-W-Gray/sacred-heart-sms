"""
management/commands/seed_essentials.py

Run: python manage.py seed_essentials

Production-safe seed command — creates only the reference data every
deployment needs (academic year/semesters, subjects, grading scale,
conduct categories). Unlike `seed_data`, it creates NO user accounts,
classes, students, or guardians, so it's safe to run against a real
school's production database (e.g. on every Render deploy).

After running this for the first time, create the real administrator
account with `python manage.py createsuperuser`.

Idempotent — safe to run multiple times.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from .. import _seed_common


class Command(BaseCommand):
    help = "Seed only the reference data required for a production deployment (no demo accounts)"

    def handle(self, *args, **options):
        self.stdout.write("🌱 Seeding Sacred Heart SMS reference data…")

        with transaction.atomic():
            _seed_common.seed_academic_year(self.stdout)
            _seed_common.seed_subjects(self.stdout)
            _seed_common.seed_grading_scale(self.stdout)
            _seed_common.seed_conduct_categories(self.stdout)

        self.stdout.write(self.style.SUCCESS("✅ Reference data ready."))
