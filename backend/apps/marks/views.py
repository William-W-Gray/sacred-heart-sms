from django.db import transaction
from rest_framework import serializers, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Mark, GradingScale, AssessmentTemplate, ConductCategory, ConductRating,
    PromotionDecision, AcademicTaskWindow,
)
from .services import find_locking_window, MARK_TASK_TYPES
from apps.students.models import Student, Class
from apps.users.views import IsAdminUser, IsAdminOrTeacher, scope_to_own_student
from apps.trash.mixins import SoftDeleteViewSetMixin
from apps.audit.mixins import AuditLogMixin
from apps.audit.models import AuditAction
from apps.audit.services import log_action


# ── Academic-duty deadline enforcement (Phase 4) ─────────────────────
LOCKED_MESSAGE = "This academic task is now locked. Please contact the Admin for help."


def assert_task_open(task_types, *, user, student, subject, semester):
    """Raise 403 if a teacher's write to this scope is locked by an admin task
    window. Admins (and other roles) bypass. Safe-additive: no window ⇒ allowed."""
    if getattr(user, "role", None) != "teacher":
        return
    teacher = getattr(user, "teacher_profile", None)
    assigned_class = getattr(student, "current_class", None)
    academic_year = getattr(assigned_class, "academic_year", None)
    win = find_locking_window(
        task_types, teacher=teacher, assigned_class=assigned_class,
        subject=subject, semester=semester, academic_year=academic_year,
    )
    if win is not None:
        raise PermissionDenied(LOCKED_MESSAGE)


def bulk_scope_locked(task_types, *, teacher, class_id, subject_id, semester_id, cache, year_cache):
    """Cached lock check for bulk upserts (teacher writes only). Returns True if
    the (class, subject, semester) scope is currently locked by an admin window,
    so the caller can skip those records the same way it skips unassigned ones."""
    key = (class_id, subject_id, semester_id)
    if key not in cache:
        if class_id not in year_cache:
            year_cache[class_id] = Class.objects.filter(pk=class_id).values_list(
                "academic_year_id", flat=True).first()
        win = find_locking_window(
            task_types, teacher=teacher, assigned_class=class_id,
            subject=subject_id, semester=semester_id, academic_year=year_cache[class_id],
        )
        cache[key] = win is not None
    return cache[key]


class GradingScaleSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GradingScale
        fields = "__all__"


class AssessmentTemplateSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    subject_name = serializers.SerializerMethodField()
    class_name   = serializers.SerializerMethodField()

    class Meta:
        model  = AssessmentTemplate
        fields = ["id", "name", "kind", "kind_display", "academic_year",
                  "semester", "class_group", "class_name", "subject", "subject_name",
                  "max_score", "weight", "is_active", "sort_order",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_subject_name(self, obj) -> str | None:
        return obj.subject.name if obj.subject else None

    def get_class_name(self, obj) -> str | None:
        return str(obj.class_group) if obj.class_group else None

    def validate(self, attrs):
        if attrs.get("max_score") is not None and attrs["max_score"] <= 0:
            raise serializers.ValidationError({"max_score": "Max score must be greater than zero."})
        return attrs


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

    def create(self, validated_data):
        # all_objects: a decision for this (student, academic_year) may
        # already exist but be trashed — restore and update it instead of
        # trying to create a duplicate, which would 400 on unique_together.
        existing = PromotionDecision.all_objects.filter(
            student=validated_data.get("student"),
            academic_year=validated_data.get("academic_year"),
        ).first()
        if existing and existing.deleted_at:
            existing.restore()
            for attr, value in validated_data.items():
                setattr(existing, attr, value)
            existing.save()
            return existing
        return super().create(validated_data)


# ── ViewSets ─────────────────────────────────────────────────────

class GradingScaleViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Grading Scale"
    audit_create_action = audit_update_action = audit_delete_action = AuditAction.SETTINGS_CHANGE
    queryset           = GradingScale.objects.all()
    serializer_class   = GradingScaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["academic_year"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class AssessmentTemplateViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    """Admin-defined grading templates. World-readable (teachers need them at
    marks-entry time), admin-gated for writes — same posture as GradingScale."""
    audit_module = "Grading Template"
    audit_create_action = audit_update_action = audit_delete_action = AuditAction.SETTINGS_CHANGE
    queryset = AssessmentTemplate.objects.select_related(
        "academic_year", "semester", "class_group", "subject"
    ).all()
    serializer_class   = AssessmentTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["academic_year", "semester", "class_group", "subject", "kind", "is_active"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class MarkViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Marks"
    audit_create_action = audit_update_action = AuditAction.MARKS_ENTRY
    queryset = Mark.objects.select_related(
        "student", "subject", "semester", "recorded_by"
    ).all()
    serializer_class   = MarkSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["student", "subject", "semester", "is_locked"]

    def get_queryset(self):
        qs = scope_to_own_student(super().get_queryset(), self.request.user)
        # Finance hold blocks a student / their guardians from seeing results;
        # staff (admin/teacher/finance) are unaffected.
        if self.request.user.role in ("student", "guardian"):
            qs = qs.filter(student__finance_hold=False)
        return qs

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
        v = serializer.validated_data
        self._check_teacher_scope(v["student"], v["subject"])
        assert_task_open(MARK_TASK_TYPES, user=self.request.user,
                         student=v["student"], subject=v["subject"], semester=v["semester"])
        super().perform_create(serializer)

    def perform_update(self, serializer):
        v = serializer.validated_data
        student  = v.get("student",  serializer.instance.student)
        subject  = v.get("subject",  serializer.instance.subject)
        semester = v.get("semester", serializer.instance.semester)
        self._check_teacher_scope(student, subject)
        assert_task_open(MARK_TASK_TYPES, user=self.request.user,
                         student=student, subject=subject, semester=semester)
        super().perform_update(serializer)

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """Upsert a batch of marks, keyed on (student, subject, semester)."""
        user    = request.user
        teacher = getattr(user, "teacher_profile", None)
        created = updated = 0
        saved   = []

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
        lock_cache, year_cache = {}, {}

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
                    class_id = class_id_cache[student_id]
                    if (class_id, subject_id) not in allowed_pairs:
                        continue  # teacher not assigned to this class/subject
                    # Skip records whose deadline window is closed/read-only.
                    if bulk_scope_locked(MARK_TASK_TYPES, teacher=teacher, class_id=class_id,
                                         subject_id=subject_id, semester_id=semester_id,
                                         cache=lock_cache, year_cache=year_cache):
                        continue

                # all_objects: a matching mark may exist but be trashed —
                # restore it instead of trying to create a duplicate, which
                # would 400 on the unique_together.
                instance = Mark.all_objects.filter(
                    student_id=student_id, subject_id=subject_id, semester_id=semester_id,
                ).first()
                if instance and instance.is_locked:
                    continue  # never overwrite a locked mark
                if instance and instance.deleted_at:
                    instance.restore()

                data = {
                    "student":    student_id,
                    "subject":    subject_id,
                    "semester":   semester_id,
                    "test_score": rec.get("test_score"),
                    "exam_score": rec.get("exam_score"),
                }
                serializer = MarkSerializer(instance, data=data, partial=True)
                if not serializer.is_valid():
                    continue  # invalid record (e.g. out-of-range score) — skip, don't abort the whole batch
                if teacher:
                    serializer.save(recorded_by=teacher)
                else:
                    serializer.save()
                saved.append(serializer.instance)

                if instance is None:
                    created += 1
                else:
                    updated += 1

        if created or updated:
            log_action(
                action=AuditAction.MARKS_ENTRY, module="Marks", request=request,
                description=f"Bulk marks entry: {created} created, {updated} updated",
                new_value={"created": created, "updated": updated},
            )

        # Notify students / guardians that marks were published (best-effort).
        try:
            from apps.notifications.services import notify_marks_published
            notify_marks_published(saved)
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to send marks notifications")

        return Response({"created": created, "updated": updated})


class ConductCategoryViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Conduct"
    audit_create_action = audit_update_action = audit_delete_action = AuditAction.SETTINGS_CHANGE
    queryset           = ConductCategory.objects.all()
    serializer_class   = ConductCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class ConductRatingViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Conduct"
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
        v = serializer.validated_data
        self._check_teacher_scope(v["student"])
        assert_task_open(("conduct",), user=self.request.user, student=v["student"],
                         subject=None, semester=v["semester"])
        super().perform_create(serializer)

    def perform_update(self, serializer):
        v = serializer.validated_data
        student  = v.get("student",  serializer.instance.student)
        semester = v.get("semester", serializer.instance.semester)
        self._check_teacher_scope(student)
        assert_task_open(("conduct",), user=self.request.user, student=student,
                         subject=None, semester=semester)
        super().perform_update(serializer)

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
        lock_cache, year_cache = {}, {}

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
                    class_id = class_id_cache[student_id]
                    if class_id not in allowed_class_ids:
                        continue  # teacher not assigned to this class
                    # Conduct windows are not subject-scoped (subject_id=None).
                    if bulk_scope_locked(("conduct",), teacher=teacher, class_id=class_id,
                                         subject_id=None, semester_id=semester_id,
                                         cache=lock_cache, year_cache=year_cache):
                        continue

                # all_objects: a matching rating may exist but be trashed —
                # restore it instead of trying to create a duplicate, which
                # would 400 on the unique_together.
                instance = ConductRating.all_objects.filter(
                    student_id=student_id, category_id=category_id, semester_id=semester_id,
                ).first()
                if instance and instance.deleted_at:
                    instance.restore()

                data = {
                    "student":  student_id,
                    "category": category_id,
                    "semester": semester_id,
                    "rating":   rec.get("rating"),
                }
                if "notes" in rec:
                    data["notes"] = rec["notes"]

                serializer = ConductRatingSerializer(instance, data=data, partial=True)
                if not serializer.is_valid():
                    continue  # invalid record — skip, don't abort the whole batch
                if teacher:
                    serializer.save(rated_by=teacher)
                else:
                    serializer.save()
                results.append(serializer.instance)

        if results:
            log_action(
                action=AuditAction.UPDATE, module="Conduct", request=request,
                description=f"Bulk conduct entry: {len(results)} rating(s) recorded",
                new_value={"count": len(results)},
            )

        return Response(ConductRatingSerializer(results, many=True).data)


class PromotionDecisionViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Promotions"
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


# ── Academic task windows (Phase 4: admin-set deadlines) ─────────────
class AcademicTaskWindowSerializer(serializers.ModelSerializer):
    task_type_display = serializers.CharField(source="get_task_type_display", read_only=True)
    status_display    = serializers.CharField(source="get_status_display", read_only=True)
    effective_status  = serializers.SerializerMethodField()
    is_editable_now   = serializers.ReadOnlyField()
    class_name        = serializers.SerializerMethodField()
    subject_name      = serializers.SerializerMethodField()
    teacher_name      = serializers.SerializerMethodField()

    class Meta:
        model  = AcademicTaskWindow
        fields = ["id", "task_type", "task_type_display", "academic_year",
                  "semester", "assigned_class", "class_name", "subject", "subject_name",
                  "teacher", "teacher_name", "open_at", "close_at", "status",
                  "status_display", "effective_status", "is_editable_now", "note",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_effective_status(self, obj) -> str:
        return obj.effective_status()

    def get_class_name(self, obj) -> str | None:
        return str(obj.assigned_class) if obj.assigned_class else None

    def get_subject_name(self, obj) -> str | None:
        return obj.subject.name if obj.subject else None

    def get_teacher_name(self, obj) -> str | None:
        return obj.teacher.full_name if obj.teacher else None

    def validate(self, attrs):
        open_at  = attrs.get("open_at",  getattr(self.instance, "open_at", None))
        close_at = attrs.get("close_at", getattr(self.instance, "close_at", None))
        if open_at and close_at and close_at < open_at:
            raise serializers.ValidationError({"close_at": "Close time must be after open time."})
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data.setdefault("created_by", request.user)
        return super().create(validated_data)


def _notify_affected_teachers(window, verb):
    """In-app notice to the teacher(s) a window affects, when an admin opens,
    closes, extends or reopens it. Scoped to the pinned class/subject when set,
    otherwise the named teacher, otherwise all active teachers."""
    from apps.teachers.models import Teacher, TeacherAssignment
    from apps.users.models import Notification

    teachers = Teacher.objects.filter(is_active=True)
    if window.teacher_id:
        teachers = teachers.filter(id=window.teacher_id)
    elif window.assigned_class_id or window.subject_id:
        assign = TeacherAssignment.objects.filter(is_active=True)
        if window.assigned_class_id:
            assign = assign.filter(assigned_class_id=window.assigned_class_id)
        if window.subject_id:
            assign = assign.filter(subject_id=window.subject_id)
        teachers = teachers.filter(id__in=set(assign.values_list("teacher_id", flat=True)))

    status = window.effective_status()
    scope  = str(window.assigned_class) if window.assigned_class else "all classes"
    title  = f"Academic task {verb}: {window.get_task_type_display()}"
    body   = (f"{window.get_task_type_display()} for {scope} is now "
              f"{dict(AcademicTaskWindow.Status.choices).get(status, status)}."
              + (f" Closes {window.close_at:%d %b %Y %H:%M}." if window.close_at and status == 'open' else ""))
    prio = Notification.Priority.HIGH if status != "open" else Notification.Priority.NORMAL
    for t in teachers.select_related("user"):
        if t.user_id:
            Notification.send(
                recipient=t.user, type=Notification.Type.GENERAL, title=title, body=body,
                module="Academic Deadlines", action_type=f"deadline_{verb}",
                related_object_id=window.id, priority=prio,
                metadata={"window_id": window.id, "task_type": window.task_type, "status": status},
            )


class AcademicTaskWindowViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Academic Deadlines"
    audit_create_action = audit_update_action = audit_delete_action = AuditAction.SETTINGS_CHANGE
    queryset = AcademicTaskWindow.objects.select_related(
        "academic_year", "semester", "assigned_class", "subject", "teacher"
    ).all()
    serializer_class   = AcademicTaskWindowSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["task_type", "academic_year", "semester", "assigned_class", "subject", "teacher", "status"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == "admin":
            return qs
        if user.role == "teacher":
            from django.db.models import Q
            teacher = getattr(user, "teacher_profile", None)
            if not teacher:
                return qs.none()
            # Windows that can affect this teacher: targeted at them, or untargeted.
            return qs.filter(Q(teacher__isnull=True) | Q(teacher=teacher))
        return qs.none()  # students/guardians/finance don't see deadline config

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        super().perform_create(serializer)
        try:
            _notify_affected_teachers(serializer.instance, "opened")
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to notify teachers of new task window")

    def perform_update(self, serializer):
        super().perform_update(serializer)
        try:
            _notify_affected_teachers(serializer.instance, "updated")
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to notify teachers of task-window update")
