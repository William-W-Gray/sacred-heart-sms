from rest_framework import serializers, viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend

from .models import Teacher, TeacherAssignment
from apps.users.views import IsAdminUser


class TeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = ["id", "full_name", "email", "phone_number", "department",
                  "employee_id", "photo", "is_active", "created_at"]
        read_only_fields = ["created_at"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        if request and request.user and request.user.role in ("student", "guardian"):
            ret.pop("phone_number", None)
            ret.pop("employee_id", None)
            ret.pop("email", None)
        return ret


class TeacherAssignmentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    subject_name = serializers.SerializerMethodField()
    class_name   = serializers.SerializerMethodField()

    class Meta:
        model  = TeacherAssignment
        fields = ["id", "teacher", "teacher_name", "assigned_class", "class_name",
                  "subject", "subject_name", "academic_year", "is_active", "assigned_at"]

    def get_teacher_name(self, obj) -> str:
        return obj.teacher.full_name

    def get_subject_name(self, obj) -> str:
        return obj.subject.name

    def get_class_name(self, obj) -> str:
        return str(obj.assigned_class)


class TeacherViewSet(viewsets.ModelViewSet):
    queryset           = Teacher.objects.select_related("user").all()
    serializer_class   = TeacherSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [filters.SearchFilter, DjangoFilterBackend]
    search_fields      = ["full_name", "email", "department"]
    filterset_fields   = ["is_active", "department"]

    def get_queryset(self):
        user = self.request.user
        qs   = super().get_queryset()
        if user.role == "teacher":
            teacher = getattr(user, "teacher_profile", None)
            if not teacher:
                return qs.none()
            return qs.filter(id=teacher.id)
        if user.role == "student":
            student = getattr(user, "student_profile", None)
            if not student or not student.current_class:
                return qs.none()
            from django.db.models import Q
            return qs.filter(
                Q(assignments__assigned_class=student.current_class, assignments__is_active=True) |
                Q(homeroom_class=student.current_class)
            ).distinct()
        if user.role == "guardian":
            guardian = getattr(user, "guardian_profile", None)
            if not guardian:
                return qs.none()
            from django.db.models import Q
            return qs.filter(
                Q(assignments__assigned_class__students__guardians=guardian, assignments__is_active=True) |
                Q(homeroom_class__students__guardians=guardian)
            ).distinct()
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class TeacherAssignmentViewSet(viewsets.ModelViewSet):
    queryset = TeacherAssignment.objects.select_related(
        "teacher", "assigned_class", "subject", "academic_year"
    ).all()
    serializer_class   = TeacherAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["teacher", "assigned_class", "subject", "academic_year", "is_active"]

    def get_queryset(self):
        user = self.request.user
        qs   = super().get_queryset()
        if user.role == "teacher":
            teacher = getattr(user, "teacher_profile", None)
            if not teacher:
                return qs.none()
            return qs.filter(teacher=teacher)
        if user.role == "student":
            student = getattr(user, "student_profile", None)
            if not student or not student.current_class:
                return qs.none()
            return qs.filter(assigned_class=student.current_class)
        if user.role == "guardian":
            guardian = getattr(user, "guardian_profile", None)
            if not guardian:
                return qs.none()
            return qs.filter(assigned_class__students__guardians=guardian).distinct()
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]
