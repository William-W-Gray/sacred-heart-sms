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


def seed_fee_types(stdout):
    """Starter fee-type catalogue so the finance office has a sensible list to
    work from out of the box (they can add more in the UI). Idempotent."""
    from apps.finance.models import FeeType
    from apps.students.models import AcademicYear
    year = AcademicYear.objects.filter(is_current=True).first()
    catalogue = [
        ("Tuition Fee",      "Termly tuition charge",                250),
        ("Registration Fee", "One-time enrolment/registration fee",   50),
        ("Development Fee",   "School development levy",               40),
        ("Exam Fee",          "Examination administration fee",        30),
        ("Sports Fee",        "Sports & physical education",           20),
        ("PTA Fee",           "Parent-Teacher Association dues",        15),
        ("Graduation Fee",    "Graduation ceremony (final year)",      75),
        ("Uniform Fee",       "School uniform",                        60),
        ("Laboratory Fee",    "Science laboratory usage",              25),
        ("Technology Fee",    "Computer lab & technology",             35),
    ]
    created = 0
    for name, desc, amount in catalogue:
        _, c = FeeType.objects.get_or_create(
            name=name,
            defaults=dict(description=desc, default_amount=amount,
                          academic_year=year, is_active=True),
        )
        if c:
            created += 1
    if created:
        stdout.write(f"  ✓ {created} fee types created")
