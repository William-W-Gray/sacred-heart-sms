"""
management/commands/seed_data.py

Run: python manage.py seed_data
Creates realistic demo data for Sacred Heart Catholic High School.
Safe to run multiple times — checks for existing data first.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from datetime import date


class Command(BaseCommand):
    help = "Seed the database with realistic demo data for Sacred Heart SMS"

    def handle(self, *args, **options):
        self.stdout.write("🌱 Seeding Sacred Heart SMS demo data…")

        with transaction.atomic():
            self._seed_academic_year()
            self._seed_subjects()
            self._seed_grading_scale()
            self._seed_conduct_categories()
            self._seed_users_and_people()

        self.stdout.write(self.style.SUCCESS("✅ Seed complete."))

    # ── Academic year ──────────────────────────────────────────
    def _seed_academic_year(self):
        from apps.students.models import AcademicYear, Semester
        year, created = AcademicYear.objects.get_or_create(
            name="2025/2026",
            defaults=dict(start_date=date(2025, 9, 1), end_date=date(2026, 6, 30), is_current=True),
        )
        if created:
            self.stdout.write("  ✓ Academic year created")
        Semester.objects.get_or_create(
            academic_year=year, number=1,
            defaults=dict(start_date=date(2025, 9, 1), end_date=date(2026, 1, 31), is_active=False),
        )
        Semester.objects.get_or_create(
            academic_year=year, number=2,
            defaults=dict(start_date=date(2026, 2, 1), end_date=date(2026, 6, 30), is_active=True),
        )

    # ── Subjects ───────────────────────────────────────────────
    def _seed_subjects(self):
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
            self.stdout.write(f"  ✓ {created} subjects created")

    # ── Grading scale ──────────────────────────────────────────
    def _seed_grading_scale(self):
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
            self.stdout.write(f"  ✓ {created} grading scale entries created")

    # ── Conduct categories ─────────────────────────────────────
    def _seed_conduct_categories(self):
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
            self.stdout.write(f"  ✓ {created} conduct categories created")

    # ── Users, teachers, classes, students ────────────────────
    def _seed_users_and_people(self):
        from apps.users.models import User
        from apps.students.models import AcademicYear, Class, Guardian, Student
        from apps.teachers.models import Teacher, TeacherAssignment
        from apps.students.models import Subject

        year = AcademicYear.objects.get(name="2025/2026")

        # Admin
        admin, created = User.objects.get_or_create(
            email="admin@sacredheart.edu.lr",
            defaults={"role": User.Role.ADMIN, "is_staff": True, "is_superuser": True},
        )
        if created:
            admin.set_password("admin123")
            admin.save()
            self.stdout.write("  ✓ Admin user created (admin@sacredheart.edu.lr / admin123)")

        # Classes
        class_data = [
            (12, "A"), (12, "B"), (11, "A"), (11, "B"),
            (10, "A"), (10, "B"), (9, "A"), (9, "B"), (9, "C"),
            (8, "A"), (8, "B"), (7, "A"), (7, "B"),
        ]
        classes = {}
        for grade, sec in class_data:
            cls, _ = Class.objects.get_or_create(
                grade=grade, section=sec, academic_year=year,
                defaults={"name": f"{grade}{sec}"},
            )
            classes[f"{grade}{sec}"] = cls

        # Teachers
        teacher_data = [
            ("Mr. Samuel Johnson",    "s.johnson@sacredheart.edu.lr",  "Sciences",           "12A", ["Chemistry", "Biology"]),
            ("Mrs. Agnes Freeman",    "a.freeman@sacredheart.edu.lr",  "Mathematics",        "12B", ["Algebra", "Geometry", "Trigonometry"]),
            ("Rev. Fr. Thomas Kollie","t.kollie@sacredheart.edu.lr",   "Religious Studies",  "11A", ["Doctrine"]),
            ("Ms. Cecelia Bestman",   "c.bestman@sacredheart.edu.lr",  "Arts & Humanities",  "11B", ["Literature", "Sociology", "Art"]),
            ("Mr. James Wesseh",      "j.wesseh@sacredheart.edu.lr",   "Social Sciences",    "10A", ["Citizenship", "Economics"]),
        ]
        for full_name, email, dept, cls_name, subject_names in teacher_data:
            user, uc = User.objects.get_or_create(email=email, defaults={"role": User.Role.TEACHER})
            if uc:
                user.set_password("teacher123")
                user.save()
            teacher, _ = Teacher.objects.get_or_create(
                user=user,
                defaults=dict(full_name=full_name, email=email, department=dept),
            )
            # Assignments
            cls_obj = classes.get(cls_name)
            if cls_obj:
                for sname in subject_names:
                    try:
                        sub = Subject.objects.get(name=sname)
                        TeacherAssignment.objects.get_or_create(
                            teacher=teacher, assigned_class=cls_obj, subject=sub, academic_year=year,
                        )
                    except Subject.DoesNotExist:
                        pass

        self.stdout.write("  ✓ Teachers and assignments created")

        # Guardians and Students
        guardian_data = [
            ("Mr. James Kollie",   "+231 886 123 456", "j.kollie@gmail.com",     "Sinkor, Monrovia",       "Civil Servant"),
            ("Mr. Peter Gbowee",   "+231 770 234 567", "p.gbowee@yahoo.com",     "Congo Town, Monrovia",   "Business Owner"),
            ("Mrs. Sarah Bestman", "+231 886 345 678", "s.bestman@gmail.com",     "Paynesville, Monrovia",  "Teacher"),
        ]
        guardians = []
        for gname, phone, gemail, addr, occ in guardian_data:
            g, _ = Guardian.objects.get_or_create(
                phone_number=phone,
                defaults=dict(full_name=gname, email=gemail, address=addr, occupation=occ),
            )
            guardians.append(g)

        student_data = [
            ("CHS-2026-001", "Mary-Rose",  "", "Kollie",  "F", "2007-03-12", "12A"),
            ("CHS-2026-002", "Emmanuel",   "", "Gbowee",  "M", "2007-07-05", "12A"),
            ("CHS-2026-012", "Ruth",       "", "Togba",   "F", "2007-06-15", "12A"),
            ("CHS-2026-018", "Grace",      "", "Bestman", "F", "2008-11-20", "11A"),
            ("CHS-2026-031", "Daniel",     "", "Wesseh",  "M", "2009-01-08", "10A"),
            ("CHS-2026-044", "Patience",   "", "Zinnah",  "F", "2009-09-14", "10A"),
            ("CHS-2026-089", "Moses",      "", "Quiah",   "M", "2010-04-03", "9C"),
        ]
        for sid, fn, mn, ln, gen, dob, cls_name in student_data:
            cls_obj = classes.get(cls_name)
            s, created = Student.objects.get_or_create(
                student_id=sid,
                defaults=dict(
                    first_name=fn, middle_name=mn, last_name=ln,
                    gender=gen, date_of_birth=dob,
                    current_class=cls_obj, status="active",
                ),
            )

        self.stdout.write("  ✓ Students and guardians created")
