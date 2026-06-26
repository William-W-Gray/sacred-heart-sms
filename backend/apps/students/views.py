from rest_framework import serializers, viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction

from .models import Student, Guardian, StudentGuardian, Class, Subject, AcademicYear, Semester
from apps.users.views import IsAdminUser, IsFinanceOfficer
from apps.trash.mixins import SoftDeleteViewSetMixin
from apps.audit.mixins import AuditLogMixin
from apps.audit.models import AuditAction
from apps.audit.services import log_action


# ── Academic year / semester ────────────────────────────────────
class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AcademicYear
        fields = "__all__"


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Semester
        fields = "__all__"


# ── Class ───────────────────────────────────────────────────────
class ClassSerializer(serializers.ModelSerializer):
    student_count    = serializers.SerializerMethodField()
    class_teacher_name = serializers.SerializerMethodField()

    class Meta:
        model  = Class
        fields = ["id", "name", "grade", "section", "academic_year",
                  "class_teacher", "class_teacher_name", "student_count"]

    def get_student_count(self, obj) -> int:
        return obj.students.filter(status="active").count()

    def get_class_teacher_name(self, obj) -> str | None:
        return obj.class_teacher.full_name if obj.class_teacher else None


# ── Subject ─────────────────────────────────────────────────────
class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Subject
        fields = ["id", "name", "code", "is_active"]


# ── Guardian ────────────────────────────────────────────────────
class GuardianSerializer(serializers.ModelSerializer):
    linked_students = serializers.SerializerMethodField()

    class Meta:
        model  = Guardian
        fields = ["id", "full_name", "phone_number", "email", "address", "occupation", "linked_students"]

    def get_linked_students(self, obj) -> list:
        links = StudentGuardian.objects.filter(guardian=obj).select_related("student")
        return [
            {
                "student_id": lnk.student.id,
                "student_name": lnk.student.full_name,
                "sid": lnk.student.student_id,
                "relationship": lnk.relationship,
                "is_primary": lnk.is_primary,
            }
            for lnk in links
        ]


# ── Student ─────────────────────────────────────────────────────
class StudentListSerializer(serializers.ModelSerializer):
    full_name  = serializers.ReadOnlyField()
    class_name = serializers.SerializerMethodField()

    class Meta:
        model  = Student
        fields = ["id", "student_id", "first_name", "middle_name", "last_name",
                  "full_name", "gender", "date_of_birth", "photo",
                  "current_class", "class_name", "status", "enrolled_at",
                  "finance_hold"]

    def get_class_name(self, obj) -> str | None:
        return str(obj.current_class) if obj.current_class else None


class StudentDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    guardians = serializers.SerializerMethodField()
    current_class_detail = ClassSerializer(source="current_class", read_only=True)
    finance_hold_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = Student
        fields = ["id", "student_id", "first_name", "middle_name", "last_name",
                  "full_name", "gender", "date_of_birth", "photo",
                  "current_class", "current_class_detail", "status",
                  "enrolled_at", "updated_at", "guardians",
                  "finance_hold", "finance_hold_reason", "finance_hold_at", "finance_hold_by_name"]
        read_only_fields = ["enrolled_at", "updated_at",
                            "finance_hold", "finance_hold_reason", "finance_hold_at", "finance_hold_by_name"]

    def get_finance_hold_by_name(self, obj) -> str | None:
        u = obj.finance_hold_by
        if not u:
            return None
        return (f"{u.first_name} {u.last_name}".strip() or u.email)

    def get_guardians(self, obj) -> list:
        links = StudentGuardian.objects.filter(student=obj).select_related("guardian")
        return [
            {
                "id": lnk.guardian.id,
                "name": lnk.guardian.full_name,
                "phone": lnk.guardian.phone_number,
                "email": lnk.guardian.email,
                "relationship": lnk.relationship,
                "is_primary": lnk.is_primary,
            }
            for lnk in links
        ]


# ── ViewSets ────────────────────────────────────────────────────
class StudentViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Students"
    queryset = Student.objects.select_related("current_class").all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "gender", "current_class"]
    search_fields    = ["first_name", "last_name", "student_id"]
    ordering_fields  = ["last_name", "first_name", "enrolled_at"]
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ("list",):
            return StudentListSerializer
        return StudentDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs   = super().get_queryset()
        if user.role == "student":
            return qs.filter(user=user)
        if user.role == "guardian":
            return qs.filter(guardians__user=user).distinct()
        if user.role == "teacher":
            teacher = getattr(user, "teacher_profile", None)
            if not teacher:
                return qs.none()
            from django.db.models import Q
            return qs.filter(
                Q(current_class__teacher_assignments__teacher=teacher, current_class__teacher_assignments__is_active=True) |
                Q(current_class__class_teacher=teacher)
            ).distinct()
        return qs  # admin and finance_officer see all

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        if self.action == "set_finance_hold":
            # Placing/lifting an academic hold is a finance action — admins are
            # view-only on finance and cannot do it (separation of duties).
            return [permissions.IsAuthenticated(), IsFinanceOfficer()]
        return [permissions.IsAuthenticated()]

    # perform_destroy comes from SoftDeleteViewSetMixin: DELETE now moves the
    # student (and, per Student.get_cascade_querysets, their marks/
    # attendance/conduct/invoices/payments/promotions) to Trash instead of
    # cascading a permanent delete — recoverable for 7 days from /api/trash/.

    @action(detail=True, methods=["get"])
    def report_card(self, request, pk=None):
        """Full data payload consumed by the report-card generator."""
        from apps.marks.services import build_report_card_data
        student = self.get_object()
        # Finance hold blocks the student themselves and their guardians from
        # seeing the report card; staff (admin/teacher/finance) are unaffected.
        if student.finance_hold and request.user.role in ("student", "guardian"):
            return Response(
                {"detail": "Your report card is on hold due to an outstanding balance. "
                           "Please contact the finance office."},
                status=status.HTTP_403_FORBIDDEN,
            )
        year = AcademicYear.objects.filter(is_current=True).first()
        if not year:
            return Response({"detail": "No active academic year."}, status=400)
        return Response(build_report_card_data(student, year))

    @action(detail=True, methods=["post"], url_path="finance-hold")
    def set_finance_hold(self, request, pk=None):
        """Finance officer places or lifts an academic hold on this student."""
        from django.utils import timezone
        student = self.get_object()
        hold = bool(request.data.get("finance_hold"))
        reason = (request.data.get("reason") or "").strip()[:255]
        student.finance_hold = hold
        student.finance_hold_reason = reason if hold else ""
        student.finance_hold_at = timezone.now() if hold else None
        student.finance_hold_by = request.user if hold else None
        student.save(update_fields=["finance_hold", "finance_hold_reason",
                                    "finance_hold_at", "finance_hold_by"])
        log_action(
            action=AuditAction.UPDATE, module="Finance", request=request, obj=student,
            description=f"{'Placed' if hold else 'Lifted'} academic finance hold on {student.full_name}"
                       + (f": {reason}" if hold and reason else ""),
        )
        # Notify the student + guardians of the hold change (best-effort).
        try:
            from apps.users.models import Notification
            title = "Academic access on hold" if hold else "Academic hold lifted"
            body = (f"Your academic records are on hold due to an outstanding balance. {reason}".strip()
                    if hold else "Your academic hold has been lifted. You can view your results again.")
            recipients = []
            if getattr(student, "user_id", None):
                recipients.append(student.user)
            for g in student.guardians.all():
                if getattr(g, "user_id", None):
                    recipients.append(g.user)
            for r in recipients:
                Notification.send(
                    recipient=r, type=Notification.Type.FEE_REMINDER, title=title, body=body,
                    module="Finance", action_type="finance_hold",
                    priority=Notification.Priority.HIGH if hold else Notification.Priority.NORMAL,
                    related_object_id=student.id,
                )
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to send finance-hold notifications")
        return Response({"finance_hold": student.finance_hold,
                         "finance_hold_reason": student.finance_hold_reason})


class GuardianViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Guardians"
    queryset           = Guardian.objects.all()
    serializer_class   = GuardianSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [filters.SearchFilter]
    search_fields      = ["full_name", "phone_number", "email"]

    def get_queryset(self):
        user = self.request.user
        qs   = super().get_queryset()
        if user.role == "guardian":
            return qs.filter(user=user)
        if user.role == "student":
            return qs.filter(students__user=user).distinct()
        if user.role == "teacher":
            teacher = getattr(user, "teacher_profile", None)
            if not teacher:
                return qs.none()
            from django.db.models import Q
            return qs.filter(
                Q(students__current_class__teacher_assignments__teacher=teacher, students__current_class__teacher_assignments__is_active=True) |
                Q(students__current_class__class_teacher=teacher)
            ).distinct()
        return qs  # admin sees all

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "set_students"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=["post"], url_path="set-students")
    def set_students(self, request, pk=None):
        """Replace all student–guardian links for this guardian (admin only)."""
        guardian = self.get_object()
        links = request.data.get("links", [])
        created_count = 0
        with transaction.atomic():
            StudentGuardian.objects.filter(guardian=guardian).delete()
            for link in links:
                student_id = link.get("student")
                if not student_id:
                    continue
                try:
                    StudentGuardian.objects.create(
                        guardian=guardian,
                        student_id=student_id,
                        relationship=link.get("relationship", "other"),
                        is_primary=bool(link.get("is_primary", False)),
                    )
                    created_count += 1
                except Exception:
                    pass  # silently skip invalid student IDs
        return Response({"linked": created_count})


class ClassViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Classes"
    queryset           = Class.objects.select_related("class_teacher", "academic_year").all()
    serializer_class   = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["academic_year", "grade"]

    def get_queryset(self):
        user = self.request.user
        qs   = super().get_queryset()
        if user.role == "student":
            student = getattr(user, "student_profile", None)
            if not student or not student.current_class:
                return qs.none()
            return qs.filter(id=student.current_class.id)
        if user.role == "guardian":
            guardian = getattr(user, "guardian_profile", None)
            if not guardian:
                return qs.none()
            return qs.filter(students__guardians=guardian).distinct()
        if user.role == "teacher":
            teacher = getattr(user, "teacher_profile", None)
            if not teacher:
                return qs.none()
            from django.db.models import Q
            return qs.filter(
                Q(teacher_assignments__teacher=teacher, teacher_assignments__is_active=True) |
                Q(class_teacher=teacher)
            ).distinct()
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class SubjectViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Subjects"
    queryset           = Subject.objects.all()
    serializer_class   = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs   = super().get_queryset()
        if user.role == "student":
            student = getattr(user, "student_profile", None)
            if not student or not student.current_class:
                return qs.none()
            return qs.filter(teacher_assignments__assigned_class=student.current_class, teacher_assignments__is_active=True).distinct()
        if user.role == "guardian":
            guardian = getattr(user, "guardian_profile", None)
            if not guardian:
                return qs.none()
            return qs.filter(teacher_assignments__assigned_class__students__guardians=guardian, teacher_assignments__is_active=True).distinct()
        if user.role == "teacher":
            teacher = getattr(user, "teacher_profile", None)
            if not teacher:
                return qs.none()
            from django.db.models import Q
            return qs.filter(
                Q(teacher_assignments__teacher=teacher, teacher_assignments__is_active=True) |
                Q(teacher_assignments__assigned_class__class_teacher=teacher, teacher_assignments__is_active=True)
            ).distinct()
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class AcademicYearViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Settings"
    audit_create_action = audit_update_action = audit_delete_action = AuditAction.SETTINGS_CHANGE
    queryset           = AcademicYear.objects.all()
    serializer_class   = AcademicYearSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class SemesterViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Settings"
    audit_create_action = audit_update_action = audit_delete_action = AuditAction.SETTINGS_CHANGE
    queryset           = Semester.objects.select_related("academic_year").all()
    serializer_class   = SemesterSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["academic_year", "number", "is_active"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]
