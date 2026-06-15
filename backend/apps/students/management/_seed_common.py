"""
management/_seed_common.py

Shared reference-data seeders used by both `seed_data` (full local/dev
demo dataset) and `seed_essentials` (production-safe: no demo accounts).
Each function is idempotent — safe to run multiple times.
"""
from datetime import date


def seed_academic_year(stdout):
    from apps.students.models import AcademicYear, Semester
    year, created = AcademicYear.objects.get_or_create(
        name="2025/2026",
        defaults=dict(start_date=date(2025, 9, 1), end_date=date(2026, 6, 30), is_current=True),
    )
    if created:
        stdout.write("  ✓ Academic year created")
    Semester.objects.get_or_create(
        academic_year=year, number=1,
        defaults=dict(start_date=date(2025, 9, 1), end_date=date(2026, 1, 31), is_active=False),
    )
    Semester.objects.get_or_create(
        academic_year=year, number=2,
        defaults=dict(start_date=date(2026, 2, 1), end_date=date(2026, 6, 30), is_active=True),
    )


def seed_subjects(stdout):
    from apps.students.models import Subject
    subjects = [
        ("Doctrine", "DOC"), ("Literature", "LIT"), ("Sociology", "SOC"),
        ("Citizenship", "CIT"), ("Economics", "ECO"), ("Geometry", "GEO"),
        ("Algebra", "ALG"), ("Trigonometry", "TRG"), ("Chemistry", "CHM"),
        ("Physics", "PHY"), ("Biology", "BIO"), ("Agriculture", "AGR"),
        ("Home Economics", "HEC"), ("Art", "ART"), ("Music", "MUS"),
    ]
    created = 0
    for name, code in subjects:
        _, c = Subject.objects.get_or_create(name=name, defaults={"code": code})
        if c:
            created += 1
    if created:
        stdout.write(f"  ✓ {created} subjects created")


def seed_grading_scale(stdout):
    from apps.students.models import AcademicYear
    from apps.marks.models import GradingScale
    year = AcademicYear.objects.get(name="2025/2026")
    scale = [
        ("A", 95, 100, "Excellent",     4.00),
        ("B", 85,  94, "Good",          3.00),
        ("C", 78,  84, "Average",       2.00),
        ("D", 70,  77, "Below Average", 1.00),
        ("F",  0,  69, "Failing",       0.00),
    ]
    created = 0
    for letter, mn, mx, desc, gpa in scale:
        _, c = GradingScale.objects.get_or_create(
            academic_year=year, grade_letter=letter,
            defaults=dict(min_score=mn, max_score=mx, description=desc, gpa_points=gpa),
        )
        if c:
            created += 1
    if created:
        stdout.write(f"  ✓ {created} grading scale entries created")


def seed_conduct_categories(stdout):
    from apps.marks.models import ConductCategory
    cats = [
        "Punctuality", "Classroom Conduct", "Homework", "General Neatness",
        "Cooperation With Others", "Respect For Elders", "Respect For School Property",
        "Participation In School Activities", "Leadership Ability", "Emotional Stability",
        "Honesty", "Self Control", "Christian Formation", "Sportsmanship",
    ]
    created = 0
    for i, name in enumerate(cats):
        _, c = ConductCategory.objects.get_or_create(name=name, defaults={"sort_order": i})
        if c:
            created += 1
    if created:
        stdout.write(f"  ✓ {created} conduct categories created")
