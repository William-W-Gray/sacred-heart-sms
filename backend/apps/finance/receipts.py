"""
apps/finance/receipts.py

Renders an official payment receipt as a PDF (in-memory, via reportlab). The
download endpoint renders fresh on each request rather than serving a stored
file — media storage is ephemeral on Render, and a receipt is cheap to rebuild
from the payment/invoice, so on-the-fly generation is both simpler and more
reliable than persisting the file.
"""
from io import BytesIO


def _school():
    """Best-effort school header data from the SchoolProfile singleton."""
    try:
        from apps.school.models import SchoolProfile
        sp = SchoolProfile.objects.first()
        if sp:
            return {
                "name": sp.school_name or "Sacred Heart Catholic High School",
                "address": sp.address or "",
                "phone": sp.phone or "",
                "email": sp.email or "",
                "motto": sp.motto or "",
            }
    except Exception:
        pass
    return {"name": "Sacred Heart Catholic High School", "address": "Monrovia, Liberia",
            "phone": "", "email": "", "motto": ""}


def render_receipt_pdf(receipt) -> bytes:
    """Build the receipt PDF and return the raw bytes."""
    from reportlab.lib.pagesizes import A5
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    payment = receipt.payment
    invoice = payment.invoice
    student = invoice.student
    school = _school()

    buf = BytesIO()
    width, height = A5
    c = canvas.Canvas(buf, pagesize=A5)

    left = 18 * mm
    right = width - 18 * mm
    y = height - 18 * mm

    def line(label, value, *, bold_value=False, gap=7 * mm):
        nonlocal y
        c.setFont("Helvetica", 9)
        c.setFillColorRGB(0.35, 0.40, 0.50)
        c.drawString(left, y, label)
        c.setFont("Helvetica-Bold" if bold_value else "Helvetica", 9)
        c.setFillColorRGB(0.10, 0.14, 0.24)
        c.drawRightString(right, y, str(value))
        y -= gap

    # ── Header ────────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 14)
    c.setFillColorRGB(0.07, 0.11, 0.20)
    c.drawCentredString(width / 2, y, school["name"])
    y -= 6 * mm
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.35, 0.40, 0.50)
    meta = " · ".join(p for p in [school["address"], school["phone"], school["email"]] if p)
    if meta:
        c.drawCentredString(width / 2, y, meta)
        y -= 5 * mm
    if school["motto"]:
        c.setFont("Helvetica-Oblique", 8)
        c.drawCentredString(width / 2, y, school["motto"])
        y -= 5 * mm

    # Gold rule
    c.setStrokeColorRGB(0.78, 0.66, 0.29)
    c.setLineWidth(1.2)
    c.line(left, y, right, y)
    y -= 9 * mm

    c.setFont("Helvetica-Bold", 12)
    c.setFillColorRGB(0.07, 0.11, 0.20)
    c.drawCentredString(width / 2, y, "OFFICIAL PAYMENT RECEIPT")
    y -= 10 * mm

    # ── Body ──────────────────────────────────────────────────────
    line("Receipt No.", receipt.receipt_number, bold_value=True)
    line("Date", payment.payment_date.strftime("%d %B %Y") if payment.payment_date else "—")
    line("Received From", student.full_name, bold_value=True)
    line("Student ID", student.student_id)
    line("Invoice", invoice.invoice_number)
    line("Fee", invoice.fee_label or invoice.get_fee_type_display())
    y -= 2 * mm
    c.setStrokeColorRGB(0.85, 0.87, 0.90)
    c.setLineWidth(0.6)
    c.line(left, y, right, y)
    y -= 9 * mm

    line("Amount Paid", f"L$ {payment.amount:,.2f}", bold_value=True)
    line("Payment Method", payment.get_method_display())
    if payment.reference_number:
        line("Reference No.", payment.reference_number)
    y -= 2 * mm
    c.setLineWidth(0.6)
    c.line(left, y, right, y)
    y -= 9 * mm

    line("Invoice Total", f"L$ {float(invoice.amount):,.2f}")
    line("Total Paid", f"L$ {invoice.amount_paid:,.2f}")
    line("Balance Due", f"L$ {invoice.balance:,.2f}", bold_value=True)

    # ── Footer ────────────────────────────────────────────────────
    y -= 6 * mm
    received_by = payment.received_by
    by_name = ""
    if received_by:
        by_name = f"{received_by.first_name} {received_by.last_name}".strip() or received_by.email
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.35, 0.40, 0.50)
    if by_name:
        c.drawString(left, y, f"Received by: {by_name}")
        y -= 5 * mm
    status = invoice.get_status_display()
    c.drawString(left, y, f"Invoice status: {status}")

    c.setFont("Helvetica-Oblique", 8)
    c.setFillColorRGB(0.45, 0.50, 0.58)
    c.drawCentredString(width / 2, 14 * mm, "Thank you for your payment.")
    c.setFont("Helvetica", 7)
    c.drawCentredString(width / 2, 9 * mm,
                        "This is a computer-generated receipt and is valid without a signature.")

    c.showPage()
    c.save()
    return buf.getvalue()
