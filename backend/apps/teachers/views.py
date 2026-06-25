from rest_framework import serializers, viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend

from .models import Teacher, TeacherAssignment
from apps.users.views import IsAdminUser
from apps.trash.mixins import SoftDeleteViewSetMixin
from apps.audit.mixins import AuditLogMixin


def _upsert_assignment(teacher, cls, subject_id, academic_year, is_active=True):
    # all_objects: a matching assignment may exist but be trashed (e.g. it
    # was removed and is being added back) — restore it instead of trying
    # to create a duplicate, which would 400 on the unique_together.
    existing = TeacherAssignment.all_objects.filter(
        teacher=teacher, assigned_class=cls, subject_id=subject_id, academic_year=academic_year,
    ).first()
    if existing:
        if existing.deleted_at:
            existing.restore()
        if not existing.is_active:
            existing.is_active = True
            existing.save(update_fields=["is_active"])
    else:
        TeacherAssignment.objects.create(
            teacher=teacher, assigned_class=cls, subject_id=subject_id,
            academic_year=academic_year, is_active=is_active,
        )


class TeacherSerializer(serializers.ModelSerializer):
    # A teacher can be the homeroom (class) teacher for more than one class,
    # so this is a list, not a single FK — write side accepts the full set
    # of class ids; read side (to_representation below) reports the same.
    class_ids = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)
    subjects = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)

    class Meta:
        model = Teacher
        fields = ["id", "full_name", "email", "phone_number", "subject",
                  "employee_id", "photo", "is_active", "created_at",
                  "class_ids", "subjects"]
        read_only_fields = ["created_at"]

    def get_class_ids(self, obj) -> list:
        return list(obj.homeroom_class.values_list("id", flat=True))

    def get_subjects(self, obj) -> list:
        return list(obj.assignments.filter(is_active=True).values_list("subject_id", flat=True).distinct())

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["class_ids"] = self.get_class_ids(instance)
        ret["subjects"] = self.get_subjects(instance)
        request = self.context.get("request")
        if request and request.user and request.user.role in ("student", "guardian"):
            ret.pop("phone_number", None)
            ret.pop("employee_id", None)
            ret.pop("email", None)
        return ret

    def validate_email(self, value):
        if value:
            from apps.users.models import User
            # all_objects: still physically unique even for a trashed row.
            qs = User.all_objects.filter(email=value)
            if self.instance and self.instance.user:
                qs = qs.exclude(id=self.instance.user.id)
            if qs.exists():
                raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_employee_id(self, value):
        if value:
            qs = Teacher.all_objects.filter(employee_id=value)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError("A teacher with this Employee ID already exists.")
        return value

    def create(self, validated_data):
        from django.db import transaction
        from apps.users.models import User
        import random

        class_ids = validated_data.pop("class_ids", None)
        subjects_data = validated_data.pop("subjects", None)

        with transaction.atomic():
            email = validated_data.get("email")
            full_name = validated_data.get("full_name", "")

            parts = full_name.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": User.Role.TEACHER,
                    "is_active": validated_data.get("is_active", True)
                }
            )
            if created:
                user.set_password("TemporaryPass123!")
                user.save()

            employee_id = validated_data.get("employee_id")
            if not employee_id:
                while True:
                    employee_id = f"EMP-{random.randint(1000, 9999)}"
                    if not Teacher.all_objects.filter(employee_id=employee_id).exists():
                        break
                validated_data["employee_id"] = employee_id

            validated_data["user"] = user
            teacher = super().create(validated_data)

            if class_ids:
                from apps.students.models import Class
                Class.objects.filter(id__in=class_ids).update(class_teacher=teacher)

            if subjects_data:
                from apps.students.models import AcademicYear
                from .models import TeacherAssignment
                active_year = AcademicYear.objects.filter(is_current=True).first()
                classes = list(teacher.homeroom_class.all())
                if active_year and classes:
                    for cls in classes:
                        for sub_id in subjects_data:
                            _upsert_assignment(teacher, cls, sub_id, active_year)

            return teacher

    def update(self, instance, validated_data):
        from django.db import transaction
        class_ids = validated_data.pop("class_ids", None)
        subjects_data = validated_data.pop("subjects", None)

        with transaction.atomic():
            teacher = super().update(instance, validated_data)

            user = teacher.user
            if user:
                user.email = teacher.email
                parts = teacher.full_name.split(" ", 1)
                user.first_name = parts[0]
                user.last_name = parts[1] if len(parts) > 1 else ""
                user.save()

            if class_ids is not None:
                from apps.students.models import Class
                Class.objects.filter(class_teacher=teacher).update(class_teacher=None)
                if class_ids:
                    Class.objects.filter(id__in=class_ids).update(class_teacher=teacher)

            if subjects_data is not None:
                from apps.students.models import AcademicYear
                from .models import TeacherAssignment

                active_year = AcademicYear.objects.filter(is_current=True).first()
                if active_year:
                    # all_objects + hard delete: this recomputes "this
                    # teacher's current assignments" from scratch — not a
                    # user deleting one they care about recovering. Soft-
                    # deleting here would just clutter Trash and immediately
                    # collide with the recreated rows below.
                    TeacherAssignment.all_objects.filter(teacher=teacher, academic_year=active_year).delete()

                    classes = list(teacher.homeroom_class.all())
                    for cls in classes:
                        for sub_id in subjects_data:
                            TeacherAssignment.objects.create(
                                teacher=teacher,
                                assigned_class=cls,
                                subject_id=sub_id,
                                academic_year=active_year,
                                is_active=True
                            )

            return teacher


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


class TeacherViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Teachers"
    queryset           = Teacher.objects.select_related("user").all()
    serializer_class   = TeacherSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends    = [filters.SearchFilter, DjangoFilterBackend]
    search_fields      = ["full_name", "email", "subject"]
    filterset_fields   = ["is_active", "subject"]

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


class TeacherAssignmentViewSet(AuditLogMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    audit_module = "Teacher Assignments"
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
