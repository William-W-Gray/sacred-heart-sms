from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenBlacklistView

from apps.users.views import SMSTokenView, UserViewSet, NotificationViewSet
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

urlpatterns = [
    path("admin/",               admin.site.urls),
    path("api/health/",          health_check, name="health-check"),

    # Auth
    path("api/auth/login/",      SMSTokenView.as_view(),       name="token_obtain"),
    path("api/auth/refresh/",    TokenRefreshView.as_view(),   name="token_refresh"),
    path("api/auth/logout/",     TokenBlacklistView.as_view(), name="token_blacklist"),

    # API v1
    path("api/",                 include(router.urls)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
