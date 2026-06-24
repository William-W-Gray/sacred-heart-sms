"""
attendance/services.py
AttendanceSummary is precomputed (unlike everything else in report cards,
which is computed live) — see CLAUDE.md / the model docstring. This is the
single place that actually does that computation, called from the bulk
endpoint (so summaries stay live without a cron job) and from
refresh_attendance_summaries (for backfills / a scheduled re-sync).
"""
from django.db.models import Count, Q


def _aggregate_and_upsert(student_ids, semester, zero_missing=False):
    """zero_missing=True also upserts an all-zero row for any of the given
    student_ids with no matching records — appropriate for a small, specific
    batch (e.g. just-saved records), but not for a whole-table refresh,
    where it would create a row for every student with no attendance yet
    in that semester at all."""
    from .models import AttendanceRecord, AttendanceSummary

    rows = (
        AttendanceRecord.objects
        .filter(student_id__in=student_ids, date__gte=semester.start_date, date__lte=semester.end_date)
        .values("student_id")
        .annotate(
            total=Count("id"),
            present=Count("id", filter=Q(status="present")),
            late=Count("id", filter=Q(status="late")),
            absent=Count("id", filter=Q(status="absent")),
            excused=Count("id", filter=Q(status="excused")),
        )
    )
    seen = set()
    for row in rows:
        seen.add(row["student_id"])
        AttendanceSummary.objects.update_or_create(
            student_id=row["student_id"], semester=semester,
            defaults={
                "total_days":    row["total"],
                "days_present":  row["present"],
                "days_late":     row["late"],
                "days_absent":   row["absent"],
                "days_excused":  row["excused"],
            },
        )
    if zero_missing:
        # E.g. a student's only records this semester were just deleted —
        # zero their summary out rather than leaving it showing stale counts.
        for student_id in set(student_ids) - seen:
            AttendanceSummary.objects.update_or_create(
                student_id=student_id, semester=semester,
                defaults={"total_days": 0, "days_present": 0, "days_late": 0, "days_absent": 0, "days_excused": 0},
            )


def refresh_summaries_for_records(records) -> None:
    """Recompute AttendanceSummary for every (student, semester) pair
    touched by the given AttendanceRecord instances. Call this right after
    any bulk write so summaries — and therefore report cards — stay correct
    without depending on someone remembering to run a scheduled job."""
    from apps.students.models import Semester

    records = list(records)
    if not records:
        return

    dates = {r.date for r in records}
    semester_by_date = {d: Semester.objects.filter(start_date__lte=d, end_date__gte=d).first() for d in dates}

    groups: dict[int, set[int]] = {}
    for r in records:
        semester = semester_by_date.get(r.date)
        if semester:
            groups.setdefault(semester.id, set()).add(r.student_id)

    if not groups:
        return
    semesters = {s.id: s for s in Semester.objects.filter(id__in=groups.keys())}
    for semester_id, student_ids in groups.items():
        _aggregate_and_upsert(student_ids, semesters[semester_id], zero_missing=True)


def refresh_all_summaries() -> int:
    """Recompute every AttendanceSummary row from scratch, one aggregation
    query per semester (not per student) — safe to re-run any time, e.g. for
    a backfill or a periodic re-sync. Returns the number of semesters processed."""
    from apps.students.models import Semester, Student

    semesters = list(Semester.objects.all())
    for semester in semesters:
        student_ids = Student.objects.values_list("id", flat=True)
        _aggregate_and_upsert(list(student_ids), semester)
    return len(semesters)
