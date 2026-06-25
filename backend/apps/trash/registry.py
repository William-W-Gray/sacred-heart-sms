"""
apps/trash/registry.py

Every soft-deletable model the Trash API should expose. Add a row here
whenever a new model picks up SoftDeleteModel — string-based lookups so
there's no import-order/circularity concern with the rest of the apps.
"""
from django.apps import apps as django_apps

# (url slug, app_label, model_name, human label, field used as the display name)
TRASH_MODELS = [
    ("user",                "users",     "User",               "User accounts",        "email"),
    ("student",              "students",  "Student",            "Students",              "full_name"),
    ("guardian",             "students",  "Guardian",           "Guardians",             "full_name"),
    ("class",                "students",  "Class",              "Classes",               "name"),
    ("subject",              "students",  "Subject",            "Subjects",              "name"),
    ("academic_year",        "students",  "AcademicYear",       "Academic years",        "name"),
    ("semester",             "students",  "Semester",           "Semesters",             "__str__"),
    ("teacher",              "teachers",  "Teacher",            "Teachers",              "full_name"),
    ("teacher_assignment",   "teachers",  "TeacherAssignment",  "Teacher assignments",   "__str__"),
    ("attendance_record",    "attendance","AttendanceRecord",   "Attendance records",    "__str__"),
    ("mark",                 "marks",     "Mark",               "Marks",                 "__str__"),
    ("grading_scale",        "marks",     "GradingScale",       "Grading scales",        "__str__"),
    ("conduct_category",     "marks",     "ConductCategory",    "Conduct categories",    "name"),
    ("conduct_rating",       "marks",     "ConductRating",      "Conduct ratings",       "__str__"),
    ("promotion_decision",   "marks",     "PromotionDecision",  "Promotion decisions",   "__str__"),
    ("invoice",              "finance",   "Invoice",            "Invoices",              "invoice_number"),
    ("payment",              "finance",   "Payment",            "Payments",              "__str__"),
]


def get_model(slug: str):
    for s, app_label, model_name, _, _ in TRASH_MODELS:
        if s == slug:
            return django_apps.get_model(app_label, model_name)
    return None


def get_label_field(slug: str) -> str:
    for s, _, _, _, label_field in TRASH_MODELS:
        if s == slug:
            return label_field
    return "__str__"


def iter_registry():
    for slug, app_label, model_name, display_name, label_field in TRASH_MODELS:
        yield slug, django_apps.get_model(app_label, model_name), display_name, label_field
