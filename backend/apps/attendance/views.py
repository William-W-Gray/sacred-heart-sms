from django.db import transaction
from rest_framework import serializers, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import AttendanceRecord, AttendanceSummary
from apps.students.models import Student
from apps.users.views import IsAdminOrTeacher, scope_to_own_student


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.SerializerMethodField()

    class Meta:
        model  = AttendanceRecord
        fields = ["id", "student", "student_name", "subject", "subject_name",
                  "class_group", "date", "status", "recorded_by", "notes", "created_at"]
        read_only_fields = ["created_at"]

    def get_student_name(self, obj) -> str:
        return obj.student.full_name

    def get_subject_name(self, obj) -> str:
        return obj.subject.name


class AttendanceSummarySerializer(serializers.ModelSerializer):
    attendance_rate = serializers.ReadOnlyField()
    student_name    = serializers.SerializerMethodField()

    class Meta:
        model  = AttendanceSummary
        fields = ["id", "student", "student_name", "semester", "total_days",
                  "days_present", "days_late", "days_absent", "days_excused",
                  "attendance_rate", "computed_at"]

    def get_student_name(self, obj) -> str:
        return obj.student.full_name


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRecord.objects.select_related(
        "student", "subject", "class_group", "recorded_by"
    ).all()
    serializer_class   = AttendanceRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "subject", "class_group", "date", "status"]

    def get_queryset(self):
        return scope_to_own_student(super().get_queryset(), self.request.user)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "bulk"):
            return [permissions.IsAuthenticated(), IsAdminOrTeacher()]
        return [permissions.IsAuthenticated()]

    def _check_teacher_scope(self, student, subject):
        """A teacher may only record attendance for their own assigned class/subject."""
        user = self.request.user
        if user.role != "teacher":
            return
        teacher = getattr(user, "teacher_profile", None)
        if not teacher or not student.current_class \
                or not teacher.can_record_for(student.current_class, subject):
            raise PermissionDenied("You are not assigned to this class/subject.")

    def perform_create(self, serializer):
        self._check_teacher_scope(serializer.validated_data["student"], serializer.validated_data["subject"])
        serializer.save()

    def perform_update(self, serializer):
        student = serializer.validated_data.get("student", serializer.instance.student)
        subject = serializer.validated_data.get("subject", serializer.instance.subject)
        self._check_teacher_scope(student, subject)
        serializer.save()

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """Upsert a batch of attendance records, keyed on (student, subject, date)."""
        user    = request.user
        teacher = getattr(user, "teacher_profile", None)
        results = []

        # A teacher may only upsert attendance for their own assigned class/subject pairs.
        allowed_pairs = None
        if user.role == "teacher":
            if not teacher:
                return Response([])
            allowed_pairs = set(
                teacher.assignments.filter(is_active=True)
                .values_list("assigned_class_id", "subject_id")
            )

        class_id_cache = {}

        with transaction.atomic():
            for rec in request.data.get("records", []):
                student_id = rec.get("student")
                subject_id = rec.get("subject")
                date       = rec.get("date")
                if not (student_id and subject_id and date):
                    continue

                if allowed_pairs is not None:
                    if student_id not in class_id_cache:
                        class_id_cache[student_id] = Student.objects.filter(
                            pk=student_id
                        ).values_list("current_class_id", flat=True).first()
                    if (class_id_cache[student_id], subject_id) not in allowed_pairs:
                        continue  # teacher not assigned to this class/subject

                instance = AttendanceRecord.objects.filter(
                    student_id=student_id, subject_id=subject_id, date=date,
                ).first()

                data = {
                    "student":     student_id,
                    "subject":     subject_id,
                    "class_group": rec.get("class_group"),
                    "date":        date,
                    "status":      rec.get("status"),
                }
                if "notes" in rec:
                    data["notes"] = rec["notes"]

                serializer = AttendanceRecordSerializer(instance, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                if teacher:
                    serializer.save(recorded_by=teacher)
                else:
                    serializer.save()
                results.append(serializer.instance)

        return Response(AttendanceRecordSerializer(results, many=True).data)


class AttendanceSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AttendanceSummary.objects.select_related("student", "semester").all()
    serializer_class   = AttendanceSummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "semester"]

    def get_queryset(self):
        return scope_to_own_student(super().get_queryset(), self.request.user)
