# notifications/tasks.py — Celery tasks for dispatching notifications
from config.celery import app


@app.task(bind=True, max_retries=3)
def dispatch_email(self, notification_id: int):
    """Send email for a Notification object."""
    try:
        from apps.users.models import Notification
        from django.core.mail import send_mail
        from django.conf import settings

        notif = Notification.objects.get(id=notification_id)
        send_mail(
            subject=notif.title,
            message=notif.body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[notif.recipient.email],
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
