"""
management/commands/refresh_attendance_summaries.py

Run: python manage.py refresh_attendance_summaries

Recomputes every AttendanceSummary row from AttendanceRecord data. The bulk
attendance endpoint already keeps summaries current for whatever it just
saved, so this is for backfilling historical data, fixing drift, or running
on a schedule (e.g. nightly) as a safety net.

Idempotent — safe to run multiple times.
"""
from django.core.management.base import BaseCommand

from apps.attendance.services import refresh_all_summaries


class Command(BaseCommand):
    help = "Recompute all AttendanceSummary rows from AttendanceRecord data"

    def handle(self, *args, **options):
        self.stdout.write("🔄 Refreshing attendance summaries…")
        count = refresh_all_summaries()
        self.stdout.write(self.style.SUCCESS(f"✅ Refreshed summaries across {count} semester(s)."))
