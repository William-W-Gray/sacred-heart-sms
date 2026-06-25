from django.db import transaction
from rest_framework import serializers, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import AttendanceRecord, AttendanceSummary
from apps.students.models import Student
from apps.users.views import IsAdminOrTeacher, scope_to_own_student
from apps.trash.mixins import SoftDeleteViewSetMixin
from apps.audit.mixins import AuditLogMixin
from apps.audit.models import AuditAction
from apps.audit.services import log_action


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


class AttendanceRecordViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Attendance"
    audit_create_action = audit_update_action = AuditAction.ATTENDANCE_ENTRY
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
        super().perform_create(serializer)

    def perform_update(self, serializer):
        student = serializer.validated_data.get("student", serializer.instance.student)
        subject = serializer.validated_data.get("subject", serializer.instance.subject)
        self._check_teacher_scope(student, subject)
        super().perform_update(serializer)

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

                # all_objects: a matching record may exist but be trashed
                # (e.g. it was deleted and is being re-entered) — restore it
                # instead of trying to create a duplicate, which would 400
                # on the unique_together.
                instance = AttendanceRecord.all_objects.filter(
                    student_id=student_id, subject_id=subject_id, date=date,
                ).first()
                if instance and instance.deleted_at:
                    instance.restore()

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
                if not serializer.is_valid():
                    continue  # invalid record — skip, don't abort the whole batch
                if teacher:
                    serializer.save(recorded_by=teacher)
                else:
                    serializer.save()
                results.append(serializer.instance)

        # Best-effort: the attendance records themselves already committed
        # above, so a failure recomputing the (precomputed, cache-like)
        # summary shouldn't turn an otherwise-successful save into an error.
        try:
            from .services import refresh_summaries_for_records
            refresh_summaries_for_records(results)
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to refresh AttendanceSummary after bulk save")

        if results:
            log_action(
                action=AuditAction.ATTENDANCE_ENTRY, module="Attendance", request=request,
                description=f"Bulk attendance entry: {len(results)} record(s)",
                new_value={"count": len(results)},
            )

        return Response(AttendanceRecordSerializer(results, many=True).data)


class AttendanceSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AttendanceSummary.objects.select_related("student", "semester").all()
    serializer_class   = AttendanceSummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "semester"]

    def get_queryset(self):
        return scope_to_own_student(super().get_queryset(), self.request.user)
