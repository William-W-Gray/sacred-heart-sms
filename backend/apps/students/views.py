from rest_framework import serializers, viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

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
    class Meta:
        model  = Guardian
        fields = ["id", "full_name", "phone_number", "email", "address", "occupation"]


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
            class_ids = teacher.assignments.filter(is_active=True).values_list("assigned_class_id", flat=True)
            return qs.filter(current_class_id__in=class_ids)
        return qs  # admin sees all

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
            class_ids = teacher.assignments.filter(is_active=True).values_list(
                "assigned_class_id", flat=True)
            return qs.filter(students__current_class_id__in=class_ids).distinct()
        return qs  # admin sees all

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class ClassViewSet(viewsets.ModelViewSet):
    queryset           = Class.objects.select_related("class_teacher", "academic_year").all()
    serializer_class   = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["academic_year", "grade"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class SubjectViewSet(viewsets.ModelViewSet):
    queryset           = Subject.objects.all()
    serializer_class   = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]

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
