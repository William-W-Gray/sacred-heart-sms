from rest_framework import serializers, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.trash.mixins import SoftDeleteViewSetMixin
from .models import User, Notification


# ── JWT with role in payload ────────────────────────────────────
class SMSTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user: User):
        token = super().get_token(user)
        token["email"]      = user.email
        token["role"]       = user.role
        token["first_name"] = user.first_name
        return token


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
            # Redis unavailable — fail open so login still works
            return True


class SMSTokenView(TokenObtainPairView):
    serializer_class = SMSTokenSerializer
    throttle_classes = [LoginRateThrottle]


# ── User serializers ────────────────────────────────────────────
class UserSerializer(serializers.ModelSerializer):
    profile_details = serializers.SerializerMethodField(read_only=True)

    # Profile fields for create/update
    student_id = serializers.CharField(required=False, write_only=True, allow_blank=True)
    gender = serializers.CharField(required=False, write_only=True, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, write_only=True, allow_null=True)
    current_class = serializers.IntegerField(required=False, write_only=True, allow_null=True)
    class_ids = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)

    employee_id = serializers.CharField(required=False, write_only=True, allow_blank=True)
    subject = serializers.CharField(required=False, write_only=True, allow_blank=True)
    phone_number = serializers.CharField(required=False, write_only=True, allow_blank=True)

    address = serializers.CharField(required=False, write_only=True, allow_blank=True)
    occupation = serializers.CharField(required=False, write_only=True, allow_blank=True)

    guardian_id = serializers.IntegerField(required=False, write_only=True, allow_null=True)
    relationship = serializers.CharField(required=False, write_only=True, allow_blank=True)
    student_id_link = serializers.IntegerField(required=False, write_only=True, allow_null=True)

    class Meta:
        model  = User
        fields = [
            "id", "email", "first_name", "last_name", "role", "is_active", "date_joined", "profile_details",
            "student_id", "gender", "date_of_birth", "current_class",
            "employee_id", "subject", "phone_number",
            "address", "occupation", "guardian_id", "relationship", "student_id_link", "class_ids"
        ]
        read_only_fields = ["date_joined"]

    def get_profile_details(self, obj) -> dict | None:
        sp = getattr(obj, "student_profile", None)
        if obj.role == User.Role.STUDENT and sp:
            return {
                "student_id": sp.student_id,
                "gender": sp.gender,
                "current_class_name": str(sp.current_class) if sp.current_class else None,
                "class_id": sp.current_class.id if sp.current_class else None,
            }
        tp = getattr(obj, "teacher_profile", None)
        if obj.role == User.Role.TEACHER and tp:
            classes = tp.homeroom_class.all()
            return {
                "employee_id": tp.employee_id,
                "subject": tp.subject,
                "phone_number": tp.phone_number,
                "homeroom_class_name": ", ".join([str(c) for c in classes]) if classes.exists() else None,
                "class_ids": [c.id for c in classes],
            }
        gp = getattr(obj, "guardian_profile", None)
        if obj.role == User.Role.GUARDIAN and gp:
            return {
                "phone_number": gp.phone_number,
                "address": gp.address,
                "occupation": gp.occupation,
            }
        return None

    def validate_student_id(self, value):
        if value:
            from apps.students.models import Student
            # all_objects, not objects: the value is still physically
            # unique in the DB even for a trashed row, so this needs to
            # catch a collision with one too (clean 400 here beats a raw
            # IntegrityError surfacing later).
            qs = Student.all_objects.filter(student_id=value)
            if self.instance:
                qs = qs.exclude(user=self.instance)
            if qs.exists():
                raise serializers.ValidationError("A student with this Student ID already exists.")
        return value

    def validate_employee_id(self, value):
        if value:
            from apps.teachers.models import Teacher
            qs = Teacher.all_objects.filter(employee_id=value)
            if self.instance:
                qs = qs.exclude(user=self.instance)
            if qs.exists():
                raise serializers.ValidationError("A teacher with this Employee ID already exists.")
        return value

    def update(self, instance, validated_data: dict) -> User:
        from django.db import transaction
        student_id = validated_data.pop("student_id", None)
        gender = validated_data.pop("gender", None)
        date_of_birth = validated_data.pop("date_of_birth", None)
        current_class_id = validated_data.pop("current_class", None)
        class_ids = validated_data.pop("class_ids", None)

        employee_id = validated_data.pop("employee_id", None)
        subject = validated_data.pop("subject", None)
        phone_number = validated_data.pop("phone_number", None)

        address = validated_data.pop("address", None)
        occupation = validated_data.pop("occupation", None)

        guardian_id = validated_data.pop("guardian_id", None)
        relationship = validated_data.pop("relationship", None)
        student_id_link = validated_data.pop("student_id_link", None)

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            role = instance.role
            if role == User.Role.STUDENT:
                from apps.students.models import Student, Class, Guardian, StudentGuardian
                sp, _ = Student.objects.get_or_create(user=instance, defaults={"student_id": student_id or f"CHS-UPD-{instance.id}"})
                if student_id: sp.student_id = student_id
                if gender: sp.gender = gender
                if date_of_birth: sp.date_of_birth = date_of_birth
                if current_class_id is not None:
                    sp.current_class_id = current_class_id
                sp.first_name = instance.first_name
                sp.last_name = instance.last_name
                sp.save()
                if guardian_id:
                    try:
                        guardian = Guardian.objects.get(id=guardian_id)
                        StudentGuardian.objects.get_or_create(
                            student=sp,
                            guardian=guardian,
                            defaults={"relationship": relationship or "other", "is_primary": True}
                        )
                    except Guardian.DoesNotExist:
                        pass

            elif role == User.Role.TEACHER:
                from apps.teachers.models import Teacher
                tp, _ = Teacher.objects.get_or_create(
                    user=instance,
                    defaults={"full_name": f"{instance.first_name} {instance.last_name}".strip(), "email": instance.email}
                )
                if employee_id: tp.employee_id = employee_id
                if subject: tp.subject = subject
                if phone_number: tp.phone_number = phone_number
                tp.full_name = f"{instance.first_name} {instance.last_name}".strip()
                tp.email = instance.email
                tp.save()

                if class_ids is not None or current_class_id is not None:
                    from apps.students.models import Class
                    Class.objects.filter(class_teacher=tp).update(class_teacher=None)
                    ids_to_assign = class_ids if class_ids is not None else ([current_class_id] if current_class_id else [])
                    if ids_to_assign:
                        Class.objects.filter(id__in=ids_to_assign).update(class_teacher=tp)

            elif role == User.Role.GUARDIAN:
                from apps.students.models import Guardian, Student, StudentGuardian
                gp, _ = Guardian.objects.get_or_create(
                    user=instance,
                    defaults={"full_name": f"{instance.first_name} {instance.last_name}".strip(), "phone_number": phone_number or ""}
                )
                if phone_number: gp.phone_number = phone_number
                if address: gp.address = address
                if occupation: gp.occupation = occupation
                gp.full_name = f"{instance.first_name} {instance.last_name}".strip()
                gp.email = instance.email
                gp.save()
                if student_id_link:
                    try:
                        student = Student.objects.get(id=student_id_link)
                        StudentGuardian.objects.get_or_create(
                            student=student,
                            guardian=gp,
                            defaults={"relationship": relationship or "other", "is_primary": True}
                        )
                    except Student.DoesNotExist:
                        pass

        return instance


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    # Profile fields for create/update
    student_id = serializers.CharField(required=False, write_only=True, allow_blank=True)
    gender = serializers.CharField(required=False, write_only=True, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, write_only=True, allow_null=True)
    current_class = serializers.IntegerField(required=False, write_only=True, allow_null=True)
    class_ids = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)

    employee_id = serializers.CharField(required=False, write_only=True, allow_blank=True)
    subject = serializers.CharField(required=False, write_only=True, allow_blank=True)
    phone_number = serializers.CharField(required=False, write_only=True, allow_blank=True)

    address = serializers.CharField(required=False, write_only=True, allow_blank=True)
    occupation = serializers.CharField(required=False, write_only=True, allow_blank=True)

    guardian_id = serializers.IntegerField(required=False, write_only=True, allow_null=True)
    relationship = serializers.CharField(required=False, write_only=True, allow_blank=True)
    student_id_link = serializers.IntegerField(required=False, write_only=True, allow_null=True)

    class Meta:
        model  = User
        fields = [
            "id", "email", "first_name", "last_name", "role", "password",
            "student_id", "gender", "date_of_birth", "current_class",
            "employee_id", "subject", "phone_number",
            "address", "occupation", "guardian_id", "relationship", "student_id_link", "class_ids"
        ]

    def validate_email(self, value):
        # DRF's auto-added UniqueValidator for this field only checks
        # User.objects (the filtered manager), so it would miss a
        # collision with a trashed account's still-unique email.
        if User.all_objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists. If it belongs to a trashed account, restore it from Trash instead."
            )
        return value

    def validate_student_id(self, value):
        if value:
            from apps.students.models import Student
            qs = Student.all_objects.filter(student_id=value)
            if qs.exists():
                raise serializers.ValidationError("A student with this Student ID already exists.")
        return value

    def validate_employee_id(self, value):
        if value:
            from apps.teachers.models import Teacher
            qs = Teacher.all_objects.filter(employee_id=value)
            if qs.exists():
                raise serializers.ValidationError("A teacher with this Employee ID already exists.")
        return value

    def create(self, validated_data: dict) -> User:
        from django.db import transaction
        role = validated_data.get("role")
        email = validated_data.get("email")
        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")

        # Extract profile fields
        student_id = validated_data.pop("student_id", None)
        gender = validated_data.pop("gender", "M")
        date_of_birth = validated_data.pop("date_of_birth", None)
        current_class_id = validated_data.pop("current_class", None)
        class_ids = validated_data.pop("class_ids", None)

        employee_id = validated_data.pop("employee_id", "")
        subject = validated_data.pop("subject", "")
        phone_number = validated_data.pop("phone_number", "")

        address = validated_data.pop("address", "")
        occupation = validated_data.pop("occupation", "")

        # Also handle links
        guardian_id = validated_data.pop("guardian_id", None)
        relationship = validated_data.pop("relationship", "other")
        student_id_link = validated_data.pop("student_id_link", None)

        with transaction.atomic():
            user = User.objects.create_user(**validated_data)

            if role == User.Role.STUDENT:
                from apps.students.models import Student, Class, Guardian, StudentGuardian
                if not student_id:
                    import random
                    from django.utils import timezone
                    year = timezone.now().year
                    while True:
                        student_id = f"CHS-{year}-{random.randint(1000, 9999)}"
                        # all_objects: a trashed student's id is still
                        # physically unique in the DB.
                        if not Student.all_objects.filter(student_id=student_id).exists():
                            break

                student = Student.objects.create(
                    user=user,
                    student_id=student_id,
                    first_name=first_name,
                    last_name=last_name,
                    gender=gender,
                    date_of_birth=date_of_birth,
                    current_class_id=current_class_id
                )
                if guardian_id:
                    try:
                        guardian = Guardian.objects.get(id=guardian_id)
                        StudentGuardian.objects.create(
                            student=student,
                            guardian=guardian,
                            relationship=relationship,
                            is_primary=True
                        )
                    except Guardian.DoesNotExist:
                        pass

            elif role == User.Role.TEACHER:
                from apps.teachers.models import Teacher
                if not employee_id:
                    import random
                    while True:
                        employee_id = f"EMP-{random.randint(1000, 9999)}"
                        if not Teacher.all_objects.filter(employee_id=employee_id).exists():
                            break

                teacher = Teacher.objects.create(
                    user=user,
                    full_name=f"{first_name} {last_name}".strip(),
                    email=email,
                    employee_id=employee_id,
                    subject=subject,
                    phone_number=phone_number
                )
                
                ids_to_assign = class_ids if class_ids is not None else ([current_class_id] if current_class_id else [])
                if ids_to_assign:
                    from apps.students.models import Class
                    Class.objects.filter(id__in=ids_to_assign).update(class_teacher=teacher)

            elif role == User.Role.GUARDIAN:
                from apps.students.models import Guardian, Student, StudentGuardian
                guardian = Guardian.objects.create(
                    user=user,
                    full_name=f"{first_name} {last_name}".strip(),
                    phone_number=phone_number,
                    email=email,
                    address=address,
                    occupation=occupation
                )
                if student_id_link:
                    try:
                        student = Student.objects.get(id=student_id_link)
                        StudentGuardian.objects.create(
                            student=student,
                            guardian=guardian,
                            relationship=relationship,
                            is_primary=True
                        )
                    except Student.DoesNotExist:
                        pass

        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_old_password(self, value: str) -> str:
        user: User = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


# ── Notification serializer ─────────────────────────────────────
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Notification
        fields = ["id", "notification_type", "channel", "title", "body",
                  "is_read", "metadata", "created_at"]


# ── ViewSets ────────────────────────────────────────────────────
class UserViewSet(SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("email")
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role != "admin":
            return qs.filter(id=user.id)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        # self.action is the view method name ("reset_password"), not the
        # url_path kwarg ("reset-password") — easy to typo-miss, and missing
        # it here means any authenticated user could force-set a password
        # (their own, since get_queryset still scopes non-admins to
        # themselves) without the old-password check change_password enforces.
        if self.action in ["create", "list", "retrieve", "destroy", "partial_update", "update", "reset_password"]:
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return super().get_permissions()

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        """Admin: force-set a user's password without knowing the old one."""
        user = self.get_object()
        new_password = request.data.get("password", "")
        if len(new_password) < 8:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"password": "Password must be at least 8 characters."})
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password reset successfully."})

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"detail": "Password updated successfully."})


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response({"detail": "Marked as read."})

    @action(detail=False, methods=["post"], url_path="read-all")
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"detail": "All notifications marked as read."})


# ── Permission classes ──────────────────────────────────────────
class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsAdminOrFinanceOfficer(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ("admin", "finance_officer"))


class IsAdminOrTeacher(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated
                     and request.user.role in ("admin", "teacher"))


# ── RBAC queryset scoping ────────────────────────────────────────
def scope_to_own_student(qs, user, prefix="student", teacher_sees_classes=True):
    """Row-level RBAC for querysets that hang off a Student FK, directly or
    via a relation chain (e.g. prefix="invoice__student").

    - student         -> only their own record
    - guardian        -> only their linked students' records
    - teacher         -> records for students in their actively-assigned classes
                         or classes where they are the homeroom teacher
                         (or none() if teacher_sees_classes=False, e.g. finance)
    - finance_officer -> none (no access to academic records; finance data handled
                         separately in finance/views.py via IsAdminOrFinanceOfficer)
    - admin           -> unrestricted
    """
    if user.role == "student":
        return qs.filter(**{f"{prefix}__user": user})
    if user.role == "guardian":
        return qs.filter(**{f"{prefix}__guardians__user": user}).distinct()
    if user.role == "teacher":
        if not teacher_sees_classes:
            return qs.none()
        teacher = getattr(user, "teacher_profile", None)
        if not teacher:
            return qs.none()
        from django.db.models import Q
        return qs.filter(
            Q(**{f"{prefix}__current_class__teacher_assignments__teacher": teacher, f"{prefix}__current_class__teacher_assignments__is_active": True}) |
            Q(**{f"{prefix}__current_class__class_teacher": teacher})
        ).distinct()
    if user.role == "finance_officer":
        return qs.none()  # finance officers have no access to academic records
    return qs  # admin sees all
