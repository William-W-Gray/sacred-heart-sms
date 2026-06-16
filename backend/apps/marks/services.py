"""
marks/services.py
All grade calculation and report-card assembly logic lives here.
Framework-agnostic: no Django request/response objects.
"""
from __future__ import annotations
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import Avg, Sum, Count, Q

if TYPE_CHECKING:
    from apps.students.models import Student, AcademicYear


def _safe_avg(*values) -> float | None:
    """Average of non-null numeric values; None if all null."""
    clean = [float(v) for v in values if v is not None]
    if not clean:
        return None
    return round(sum(clean) / len(clean), 2)


def compute_student_year_average(student: "Student", academic_year: "AcademicYear") -> float | None:
    from apps.marks.models import Mark
    marks = Mark.objects.filter(student=student, semester__academic_year=academic_year)
    avgs = []
    for m in marks:
        s1 = m.semester_average if m.semester.number == 1 else None
        s2 = m.semester_average if m.semester.number == 2 else None
        # Collect per-subject avg across semesters
    # Aggregate per subject
    subject_ids = marks.values_list("subject_id", flat=True).distinct()
    for sid in subject_ids:
        s1_mark = marks.filter(subject_id=sid, semester__number=1).first()
        s2_mark = marks.filter(subject_id=sid, semester__number=2).first()
        s1_avg  = s1_mark.semester_average if s1_mark else None
        s2_avg  = s2_mark.semester_average if s2_mark else None
        ya = _safe_avg(s1_avg, s2_avg)
        if ya is not None:
            avgs.append(ya)
    return _safe_avg(*avgs) if avgs else None


def compute_class_ranking(class_id: int, academic_year: "AcademicYear") -> list[dict]:
    """Rank students by year average. Fetches ALL marks in ONE query — no N+1."""
    from collections import defaultdict
    from apps.students.models import Student
    from apps.marks.models import Mark

    students = list(Student.objects.filter(current_class_id=class_id, status="active"))
    student_ids = [s.pk for s in students]

    # Batch-fetch all marks for all students in the class in a single query
    marks_qs = Mark.objects.filter(
        student_id__in=student_ids,
        semester__academic_year=academic_year,
    ).values("student_id", "subject_id", "test_score", "exam_score", "semester__number")

    # Group by (student_id, subject_id, semester_number) in Python
    # Structure: {student_id: {subject_id: {sem_num: Mark values}}}
    student_subject_sems: dict = defaultdict(lambda: defaultdict(dict))
    for m in marks_qs:
        student_subject_sems[m["student_id"]][m["subject_id"]][m["semester__number"]] = m

    # Compute per-student year average using the same logic as compute_student_year_average
    results = []
    for student in students:
        subject_data = student_subject_sems.get(student.pk, {})
        subject_avgs = []
        for sid, sems in subject_data.items():
            sem_avgs = []
            for sem_num, m in sems.items():
                t, e = m["test_score"], m["exam_score"]
                if t is not None and e is not None:
                    sem_avgs.append(float(t) * 0.4 + float(e) * 0.6)
                elif t is not None:
                    sem_avgs.append(float(t))
                elif e is not None:
                    sem_avgs.append(float(e))
            if sem_avgs:
                subject_avgs.append(_safe_avg(*sem_avgs))
        year_avg = _safe_avg(*subject_avgs) if subject_avgs else None
        results.append({"student": student, "avg": year_avg or 0.0, "rank": None, "class_size": None})

    results.sort(key=lambda x: x["avg"], reverse=True)
    class_size = len(results)
    for i, item in enumerate(results):
        item["rank"] = i + 1
        item["class_size"] = class_size
    return results


def build_report_card_data(student: "Student", academic_year: "AcademicYear") -> dict:
    """
    Assemble every piece of data for the report card PDF / frontend renderer.
    Returns a plain dict — no serializer dependency.
    """
    from apps.marks.models import Mark, GradingScale, ConductRating, PromotionDecision
    from apps.attendance.models import AttendanceSummary
    from apps.students.models import Subject

    subjects = Subject.objects.filter(is_active=True)
    subject_rows = []

    for sub in subjects:
        s1 = Mark.objects.filter(student=student, subject=sub, semester__number=1, semester__academic_year=academic_year).first()
        s2 = Mark.objects.filter(student=student, subject=sub, semester__number=2, semester__academic_year=academic_year).first()
        s1_avg = s1.semester_average if s1 else None
        s2_avg = s2.semester_average if s2 else None
        ya     = _safe_avg(s1_avg, s2_avg)
        if ya is None and s1 is None and s2 is None:
            continue
        grade = GradingScale.letter_for(ya, academic_year) if ya is not None else "—"
        subject_rows.append({
            "subject":    sub.name,
            "s1_test":    float(s1.test_score)  if s1 and s1.test_score  is not None else None,
            "s1_exam":    float(s1.exam_score)  if s1 and s1.exam_score  is not None else None,
            "s1_average": s1_avg,
            "s2_test":    float(s2.test_score)  if s2 and s2.test_score  is not None else None,
            "s2_exam":    float(s2.exam_score)  if s2 and s2.exam_score  is not None else None,
            "s2_average": s2_avg,
            "year_average": ya,
            "grade":      grade,
        })

    # Ranking
    ranking_list = compute_class_ranking(student.current_class_id, academic_year)
    my_rank      = next((r for r in ranking_list if r["student"].id == student.id), None)

    # Conduct
    conduct_ratings = ConductRating.objects.filter(
        student=student,
        semester__academic_year=academic_year,
    ).select_related("category").order_by("category__sort_order")

    # Attendance
    att = AttendanceSummary.objects.filter(
        student=student, semester__academic_year=academic_year,
    ).aggregate(
        total=Sum("total_days"),
        present=Sum("days_present"),
        absent=Sum("days_absent"),
        late=Sum("days_late"),
    )

    # Promotion
    promo = PromotionDecision.objects.filter(student=student, academic_year=academic_year).first()

    return {
        "student": {
            "id":            student.id,
            "student_id":    student.student_id,
            "full_name":     student.full_name,
            "gender":        student.get_gender_display(),
            "date_of_birth": str(student.date_of_birth) if student.date_of_birth else None,
            "class":         str(student.current_class) if student.current_class else None,
        },
        "academic_year": str(academic_year),
        "subjects":      subject_rows,
        "conduct":       [{"category": r.category.name, "rating": r.rating} for r in conduct_ratings],
        "attendance":    att,
        "ranking": {
            "rank":         my_rank["rank"] if my_rank else None,
            "class_size":   my_rank["class_size"] if my_rank else None,
            "year_average": my_rank["avg"] if my_rank else None,
        },
        "promotion": {
            "decision":         promo.decision if promo else None,
            "decision_display": promo.get_decision_display() if promo else None,
        },
    }
