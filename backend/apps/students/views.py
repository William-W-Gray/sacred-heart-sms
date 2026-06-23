from rest_framework import serializers, viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction

from .models import Student, Guardian, StudentGuardian, Class, Subject, AcademicYear, Semester
from apps.users.views import IsAdminUser


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
                  "current_class", "class_name", "status", "enrolled_at"]

    def get_class_name(self, obj) -> str | None:
        return str(obj.current_class) if obj.current_class else None


class StudentDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    guardians = serializers.SerializerMethodField()
    current_class_detail = ClassSerializer(source="current_class", read_only=True)

    class Meta:
        model  = Student
        fields = ["id", "student_id", "first_name", "middle_name", "last_name",
                  "full_name", "gender", "date_of_birth", "photo",
                  "current_class", "current_class_detail", "status",
                  "enrolled_at", "updated_at", "guardians"]
        read_only_fields = ["enrolled_at", "updated_at"]

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
class StudentViewSet(viewsets.ModelViewSet):
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
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=["get"])
    def report_card(self, request, pk=None):
        """Full data payload consumed by the report-card generator."""
        from apps.marks.services import build_report_card_data
        student = self.get_object()
        year = AcademicYear.objects.filter(is_current=True).first()
        if not year:
            return Response({"detail": "No active academic year."}, status=400)
        return Response(build_report_card_data(student, year))


class GuardianViewSet(viewsets.ModelViewSet):
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


class ClassViewSet(viewsets.ModelViewSet):
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


class SubjectViewSet(viewsets.ModelViewSet):
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


class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset           = AcademicYear.objects.all()
    serializer_class   = AcademicYearSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class SemesterViewSet(viewsets.ModelViewSet):
    queryset           = Semester.objects.select_related("academic_year").all()
    serializer_class   = SemesterSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["academic_year", "number", "is_active"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]
