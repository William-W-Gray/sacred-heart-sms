from django.db import transaction
from rest_framework import serializers, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Mark, GradingScale, ConductCategory, ConductRating, PromotionDecision
from apps.students.models import Student
from apps.users.views import IsAdminUser, IsAdminOrTeacher, scope_to_own_student


class GradingScaleSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GradingScale
        fields = "__all__"


class MarkSerializer(serializers.ModelSerializer):
    semester_average = serializers.ReadOnlyField()
    student_name     = serializers.SerializerMethodField()
    subject_name     = serializers.SerializerMethodField()

    class Meta:
        model  = Mark
        fields = ["id", "student", "student_name", "subject", "subject_name",
                  "semester", "recorded_by", "test_score", "exam_score",
                  "semester_average", "is_locked", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_student_name(self, obj) -> str:
        return obj.student.full_name

    def get_subject_name(self, obj) -> str:
        return obj.subject.name


class ConductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = ConductCategory
        fields = ["id", "name", "sort_order", "is_active"]


class ConductRatingSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()
    student_name  = serializers.SerializerMethodField()

    class Meta:
        model  = ConductRating
        fields = ["id", "student", "student_name", "category", "category_name",
                  "semester", "rated_by", "rating", "notes", "updated_at"]

    def get_category_name(self, obj) -> str:
        return obj.category.name

    def get_student_name(self, obj) -> str:
        return obj.student.full_name


class PromotionDecisionSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model  = PromotionDecision
        fields = ["id", "student", "student_name", "academic_year",
                  "current_class", "next_class", "decision",
                  "decided_by", "reason", "decided_at"]

    def get_student_name(self, obj) -> str:
        return obj.student.full_name


# ── ViewSets ─────────────────────────────────────────────────────

class GradingScaleViewSet(viewsets.ModelViewSet):
    queryset           = GradingScale.objects.all()
    serializer_class   = GradingScaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["academic_year"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class MarkViewSet(viewsets.ModelViewSet):
    queryset = Mark.objects.select_related(
        "student", "subject", "semester", "recorded_by"
    ).all()
    serializer_class   = MarkSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "subject", "semester", "is_locked"]

    def get_queryset(self):
        return scope_to_own_student(super().get_queryset(), self.request.user)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "bulk"):
            return [permissions.IsAuthenticated(), IsAdminOrTeacher()]
        return [permissions.IsAuthenticated()]

    def _check_teacher_scope(self, student, subject):
        """A teacher may only record marks for their own assigned class/subject."""
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
        """Upsert a batch of marks, keyed on (student, subject, semester)."""
        user    = request.user
        teacher = getattr(user, "teacher_profile", None)
        created = updated = 0

        # A teacher may only upsert marks for their own assigned class/subject pairs.
        allowed_pairs = None
        if user.role == "teacher":
            if not teacher:
                return Response({"created": 0, "updated": 0})
            allowed_pairs = set(
                teacher.assignments.filter(is_active=True)
                .values_list("assigned_class_id", "subject_id")
            )

        class_id_cache = {}

        with transaction.atomic():
            for rec in request.data.get("records", []):
                student_id  = rec.get("student")
                subject_id  = rec.get("subject")
                semester_id = rec.get("semester")
                if not (student_id and subject_id and semester_id):
                    continue

                if allowed_pairs is not None:
                    if student_id not in class_id_cache:
                        class_id_cache[student_id] = Student.objects.filter(
                            pk=student_id
                        ).values_list("current_class_id", flat=True).first()
                    if (class_id_cache[student_id], subject_id) not in allowed_pairs:
                        continue  # teacher not assigned to this class/subject

                instance = Mark.objects.filter(
                    student_id=student_id, subject_id=subject_id, semester_id=semester_id,
                ).first()
                if instance and instance.is_locked:
                    continue  # never overwrite a locked mark

                data = {
                    "student":    student_id,
                    "subject":    subject_id,
                    "semester":   semester_id,
                    "test_score": rec.get("test_score"),
                    "exam_score": rec.get("exam_score"),
                }
                serializer = MarkSerializer(instance, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                if teacher:
                    serializer.save(recorded_by=teacher)
                else:
                    serializer.save()

                if instance is None:
                    created += 1
                else:
                    updated += 1

        return Response({"created": created, "updated": updated})


class ConductCategoryViewSet(viewsets.ModelViewSet):
    queryset           = ConductCategory.objects.all()
    serializer_class   = ConductCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class ConductRatingViewSet(viewsets.ModelViewSet):
    queryset = ConductRating.objects.select_related(
        "student", "category", "semester", "rated_by"
    ).all()
    serializer_class   = ConductRatingSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "semester", "category"]

    def get_queryset(self):
        return scope_to_own_student(super().get_queryset(), self.request.user)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "bulk"):
            return [permissions.IsAuthenticated(), IsAdminOrTeacher()]
        return [permissions.IsAuthenticated()]

    def _check_teacher_scope(self, student):
        """A teacher may only rate conduct for students in their own assigned classes."""
        user = self.request.user
        if user.role != "teacher":
            return
        teacher = getattr(user, "teacher_profile", None)
        if not teacher or not student.current_class \
                or not teacher.assignments.filter(assigned_class=student.current_class, is_active=True).exists():
            raise PermissionDenied("You are not assigned to this class.")

    def perform_create(self, serializer):
        self._check_teacher_scope(serializer.validated_data["student"])
        serializer.save()

    def perform_update(self, serializer):
        student = serializer.validated_data.get("student", serializer.instance.student)
        self._check_teacher_scope(student)
        serializer.save()

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """Upsert a batch of conduct ratings, keyed on (student, category, semester)."""
        user    = request.user
        teacher = getattr(user, "teacher_profile", None)
        results = []

        # A teacher may only upsert conduct ratings for their own assigned classes.
        allowed_class_ids = None
        if user.role == "teacher":
            if not teacher:
                return Response([])
            allowed_class_ids = set(
                teacher.assignments.filter(is_active=True).values_list("assigned_class_id", flat=True)
            )

        class_id_cache = {}

        with transaction.atomic():
            for rec in request.data.get("records", []):
                student_id  = rec.get("student")
                category_id = rec.get("category")
                semester_id = rec.get("semester")
                if not (student_id and category_id and semester_id):
                    continue

                if allowed_class_ids is not None:
                    if student_id not in class_id_cache:
                        class_id_cache[student_id] = Student.objects.filter(
                            pk=student_id
                        ).values_list("current_class_id", flat=True).first()
                    if class_id_cache[student_id] not in allowed_class_ids:
                        continue  # teacher not assigned to this class

                instance = ConductRating.objects.filter(
                    student_id=student_id, category_id=category_id, semester_id=semester_id,
                ).first()

                data = {
                    "student":  student_id,
                    "category": category_id,
                    "semester": semester_id,
                    "rating":   rec.get("rating"),
                }
                if "notes" in rec:
                    data["notes"] = rec["notes"]

                serializer = ConductRatingSerializer(instance, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                if teacher:
                    serializer.save(rated_by=teacher)
                else:
                    serializer.save()
                results.append(serializer.instance)

        return Response(ConductRatingSerializer(results, many=True).data)


class PromotionDecisionViewSet(viewsets.ModelViewSet):
    queryset = PromotionDecision.objects.select_related(
        "student", "academic_year", "current_class", "next_class"
    ).all()
    serializer_class   = PromotionDecisionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "academic_year", "decision"]

    def get_queryset(self):
        return scope_to_own_student(super().get_queryset(), self.request.user)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]
