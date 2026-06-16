from rest_framework import serializers, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User, Notification


# ── JWT with role in payload ────────────────────────────────────
class SMSTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user: User):
        token = super().get_token(user)
        token["email"] = user.email
        token["role"]  = user.role
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
    class Meta:
        model  = User
        fields = ["id", "email", "role", "is_active", "date_joined"]
        read_only_fields = ["date_joined"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = User
        fields = ["id", "email", "role", "password"]

    def create(self, validated_data: dict) -> User:
        return User.objects.create_user(**validated_data)


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
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("email")
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ["create", "list", "retrieve", "destroy", "partial_update", "update"]:
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return super().get_permissions()

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


class IsAdminOrTeacher(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated
                     and request.user.role in ("admin", "teacher"))


# ── RBAC queryset scoping ────────────────────────────────────────
def scope_to_own_student(qs, user, prefix="student", teacher_sees_classes=True):
    """Row-level RBAC for querysets that hang off a Student FK, directly or
    via a relation chain (e.g. prefix="invoice__student").

    - student  -> only their own record
    - guardian -> only their linked students' records
    - teacher  -> records for students in their actively-assigned classes
                  (or none() if teacher_sees_classes=False, e.g. finance)
    - admin    -> unrestricted
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
        class_ids = teacher.assignments.filter(is_active=True).values_list(
            "assigned_class_id", flat=True)
        return qs.filter(**{f"{prefix}__current_class_id__in": class_ids})
    return qs  # admin sees all
