"""
apps/notifications/services.py

Role-based notification fan-out for school events. Each helper is best-effort:
callers wrap them in try/except so a notification failure never rolls back the
underlying academic/financial write. All notices are in-app (no email spam for
high-frequency events like attendance); the channel can be raised per-call later.
"""
import logging

from apps.users.models import Notification, User

logger = logging.getLogger(__name__)

N = Notification


def _admins():
    return User.objects.filter(role=User.Role.ADMIN, is_active=True)


def _guardian_users(student):
    """Active guardian User accounts linked to a student."""
    users = []
    for g in student.guardians.all():
        if getattr(g, "user_id", None) and getattr(g, "user", None):
            users.append(g.user)
    return users


def notify_attendance_marked(records, *, teacher_name=""):
    """Student + their guardians get a per-student notice; admins get one class
    summary. (The teacher's own confirmation is the bulk endpoint's response.)"""
    if not records:
        return
    counts = {}
    for r in records:
        counts[r.status] = counts.get(r.status, 0) + 1

    first = records[0]
    subject_name = first.subject.name
    class_name = str(first.student.current_class) if first.student.current_class else "class"
    date = str(first.date)

    for r in records:
        student = r.student
        status = r.get_status_display()
        alert = r.status in ("absent", "late")
        prio = N.Priority.HIGH if alert else N.Priority.NORMAL
        if getattr(student, "user_id", None):
            N.send(recipient=student.user, type=N.Type.ATTENDANCE_ALERT,
                   title=f"Attendance · {subject_name}",
                   body=f"You were marked {status} in {subject_name} on {date}.",
                   module="Attendance", action_type="attendance_marked",
                   related_object_id=r.id, priority=prio)
        for guser in _guardian_users(student):
            N.send(recipient=guser, type=N.Type.ATTENDANCE_ALERT,
                   title=f"{student.full_name} · {subject_name}",
                   body=f"{student.full_name} was marked {status} in {subject_name} on {date}.",
                   module="Attendance", action_type="attendance_marked",
                   related_object_id=r.id, priority=prio)

    summary = (f"{class_name} · {subject_name} attendance recorded"
               + (f" by {teacher_name}" if teacher_name else "")
               + f" on {date}: {counts.get('present', 0)} present, "
                 f"{counts.get('late', 0)} late, {counts.get('absent', 0)} absent.")
    for admin in _admins():
        N.send(recipient=admin, type=N.Type.ATTENDANCE_ALERT,
               title="Attendance recorded", body=summary,
               module="Attendance", action_type="attendance_summary")


def notify_marks_published(marks):
    """Student + guardians get a 'marks updated' notice per subject."""
    if not marks:
        return
    # de-dupe per (student, subject) so one save doesn't double-notify
    seen = set()
    for m in marks:
        key = (m.student_id, m.subject_id)
        if key in seen:
            continue
        seen.add(key)
        student = m.student
        subject_name = m.subject.name
        if getattr(student, "user_id", None):
            N.send(recipient=student.user, type=N.Type.REPORT_CARD,
                   title=f"Marks updated · {subject_name}",
                   body=f"New {subject_name} marks have been recorded. Check your results.",
                   module="Marks", action_type="marks_published",
                   related_object_id=m.id)
        for guser in _guardian_users(student):
            N.send(recipient=guser, type=N.Type.REPORT_CARD,
                   title=f"{student.full_name} · {subject_name} marks",
                   body=f"New {subject_name} marks have been recorded for {student.full_name}.",
                   module="Marks", action_type="marks_published",
                   related_object_id=m.id)


def notify_invoice_created(invoices, *, created_by=None):
    """Each new invoice notifies its student + guardians; the finance officer who
    created them gets one confirmation summary and admins get a summary too.
    Accepts a single invoice or a list (bulk fee assignment)."""
    if invoices is None:
        return
    if not isinstance(invoices, (list, tuple)):
        invoices = [invoices]
    if not invoices:
        return

    for invoice in invoices:
        student = invoice.student
        label = invoice.fee_label or invoice.get_fee_type_display()
        amount = f"L${float(invoice.amount):,.2f}"
        # due_date may be a date (serializer path) or a raw string (bulk-assign
        # path creates the instance directly, so it isn't coerced until reload).
        due_raw = invoice.due_date
        due = due_raw.strftime("%d %B %Y") if hasattr(due_raw, "strftime") else (str(due_raw) or "—")
        if getattr(student, "user_id", None):
            N.send(recipient=student.user, type=N.Type.FEE_REMINDER,
                   title=f"New invoice · {label}",
                   body=f"A new invoice of {amount} has been created for {label}. Due date: {due}.",
                   module="Finance", action_type="invoice_created",
                   related_object_id=invoice.id, priority=N.Priority.HIGH)
        for guser in _guardian_users(student):
            N.send(recipient=guser, type=N.Type.FEE_REMINDER,
                   title=f"New invoice · {student.full_name}",
                   body=f"A new invoice of {amount} has been created for {student.full_name} "
                        f"({label}). Due date: {due}.",
                   module="Finance", action_type="invoice_created",
                   related_object_id=invoice.id, priority=N.Priority.HIGH)

    # Finance-officer confirmation + admin summary (one notice for the batch).
    count = len(invoices)
    total = sum(float(inv.amount) for inv in invoices)
    summary = (f"{count} invoice{'s' if count != 1 else ''} created"
               f" · total L${total:,.2f}.")
    if created_by is not None and getattr(created_by, "is_authenticated", False):
        N.send(recipient=created_by, type=N.Type.FEE_REMINDER,
               title="Invoices created", body=summary,
               module="Finance", action_type="invoice_created")
    for admin in _admins():
        # Don't double-notify an admin who was also the creator.
        if created_by is not None and admin.id == getattr(created_by, "id", None):
            continue
        N.send(recipient=admin, type=N.Type.FEE_REMINDER,
               title="Invoices created", body=summary,
               module="Finance", action_type="invoice_created")


def notify_payment_recorded(payment):
    """Student + guardians + admins get a payment-recorded notice."""
    invoice = payment.invoice
    student = invoice.student
    amount = f"L${payment.amount:,.2f}"
    body = f"A payment of {amount} was recorded for invoice {invoice.invoice_number}."
    if getattr(student, "user_id", None):
        N.send(recipient=student.user, type=N.Type.FEE_REMINDER,
               title="Payment received", body=body,
               module="Finance", action_type="payment_recorded", related_object_id=payment.id)
    for guser in _guardian_users(student):
        N.send(recipient=guser, type=N.Type.FEE_REMINDER,
               title=f"Payment received · {student.full_name}",
               body=f"A payment of {amount} was recorded for {student.full_name} "
                    f"(invoice {invoice.invoice_number}). Balance: L${invoice.balance:,.2f}.",
               module="Finance", action_type="payment_recorded", related_object_id=payment.id)
    for admin in _admins():
        N.send(recipient=admin, type=N.Type.FEE_REMINDER,
               title="Payment recorded", body=f"{student.full_name}: {body}",
               module="Finance", action_type="payment_recorded", related_object_id=payment.id)
