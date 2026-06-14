from django.db import transaction
from rest_framework import serializers, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import AttendanceRecord, AttendanceSummary


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

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """Upsert a batch of attendance records, keyed on (student, subject, date)."""
        teacher = getattr(request.user, "teacher_profile", None)
        results = []

        with transaction.atomic():
            for rec in request.data.get("records", []):
                student_id = rec.get("student")
                subject_id = rec.get("subject")
                date       = rec.get("date")
                if not (student_id and subject_id and date):
                    continue

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
