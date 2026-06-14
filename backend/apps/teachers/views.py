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


class TeacherAssignmentViewSet(viewsets.ModelViewSet):
    queryset = TeacherAssignment.objects.select_related(
        "teacher", "assigned_class", "subject", "academic_year"
    ).all()
    serializer_class   = TeacherAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["teacher", "assigned_class", "subject", "academic_year", "is_active"]
