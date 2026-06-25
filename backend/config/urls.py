from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.views.static import serve as serve_static
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.views import SMSTokenView, SMSLogoutView, UserViewSet, NotificationViewSet
from apps.students.views import (
    StudentViewSet, GuardianViewSet, ClassViewSet,
    SubjectViewSet, AcademicYearViewSet, SemesterViewSet,
)
from apps.teachers.views import TeacherViewSet, TeacherAssignmentViewSet
from apps.attendance.views import AttendanceRecordViewSet, AttendanceSummaryViewSet
from apps.marks.views import (
    MarkViewSet, GradingScaleViewSet,
    ConductCategoryViewSet, ConductRatingViewSet,
    PromotionDecisionViewSet,
)
from apps.finance.views import InvoiceViewSet, PaymentViewSet, ReceiptViewSet
from apps.trash.views import TrashListView, TrashItemView, TrashRestoreView
from apps.snapshots.views import SnapshotViewSet
from apps.audit.views import AuditLogViewSet
from .views import health_check

router = DefaultRouter()

# People
router.register("users",      UserViewSet,      basename="user")
router.register("students",   StudentViewSet,   basename="student")
router.register("guardians",  GuardianViewSet,  basename="guardian")
router.register("teachers",   TeacherViewSet,   basename="teacher")
router.register("teacher-assignments", TeacherAssignmentViewSet, basename="teacher-assignment")

# Academic structure
router.register("academic-years", AcademicYearViewSet, basename="academic-year")
router.register("semesters",      SemesterViewSet,     basename="semester")
router.register("classes",        ClassViewSet,        basename="class")
router.register("subjects",       SubjectViewSet,      basename="subject")

# Academic activity
router.register("attendance",         AttendanceRecordViewSet,  basename="attendance")
router.register("attendance-summary", AttendanceSummaryViewSet, basename="attendance-summary")
router.register("marks",              MarkViewSet,              basename="mark")
router.register("grading-scales",     GradingScaleViewSet,      basename="grading-scale")
router.register("conduct-categories", ConductCategoryViewSet,   basename="conduct-category")
router.register("conduct-ratings",    ConductRatingViewSet,     basename="conduct-rating")
router.register("promotions",         PromotionDecisionViewSet, basename="promotion")

# Finance
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("payments", PaymentViewSet, basename="payment")
router.register("receipts", ReceiptViewSet, basename="receipt")

# Notifications
router.register("notifications", NotificationViewSet, basename="notification")

# Snapshots (admin-only data backups)
router.register("snapshots", SnapshotViewSet, basename="snapshot")

# Audit trail (admin-only, read-only)
router.register("audit-logs", AuditLogViewSet, basename="audit-log")

urlpatterns = [
    path("admin/",               admin.site.urls),
    path("api/health/",          health_check, name="health-check"),

    # Auth
    path("api/auth/login/",      SMSTokenView.as_view(),       name="token_obtain"),
    path("api/auth/refresh/",    TokenRefreshView.as_view(),   name="token_refresh"),
    path("api/auth/logout/",     SMSLogoutView.as_view(),      name="token_blacklist"),

    # Trash (soft-delete recovery, admin-only)
    path("api/trash/",                              TrashListView.as_view(),    name="trash-list"),
    path("api/trash/<str:type_>/<int:pk>/",         TrashItemView.as_view(),    name="trash-item"),
    path("api/trash/<str:type_>/<int:pk>/restore/", TrashRestoreView.as_view(), name="trash-item-restore"),

    # API v1
    path("api/",                 include(router.urls)),
]

# Local-disk media (student/teacher photos, snapshots) — only relevant when
# AWS_STORAGE_BUCKET_NAME is unset (no R2/S3 configured), e.g. docker-compose
# or local dev. Deliberately NOT gated on DEBUG: Django's django.conf.urls.
# static.static() helper silently no-ops whenever DEBUG=False, which broke
# media serving here even though docker-compose's DEBUG defaults to False —
# this is the documented "local disk fallback for docker-compose/local dev"
# path (see CLAUDE.md), so it needs to actually work outside DEBUG mode too.
if not settings.AWS_STORAGE_BUCKET_NAME:
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve_static, {"document_root": settings.MEDIA_ROOT}),
    ]
