"""Shared password-strength policy for Sacred Heart SMS.

One source of truth for the rules so user-creation, admin reset, and self-service
change all enforce the same thing. Raises DRF ValidationError with friendly,
actionable messages keyed to whichever password field the caller names.
"""
import re

from rest_framework import serializers


def validate_password_strength(
    password,
    *,
    field="password",
    email=None,
    first_name=None,
    last_name=None,
    student_id=None,
):
    """Enforce the school password policy.

    Rules: 8+ chars, at least one uppercase, lowercase, number, and special
    character, and must not echo the user's own email, name, or student ID.

    Returns the password on success; raises ``serializers.ValidationError``
    ({field: [messages]}) listing every rule that failed so the user can fix
    them all at once.
    """
    pw = password or ""
    errors = []

    if len(pw) < 8:
        errors.append("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", pw):
        errors.append("Password must include at least one uppercase letter (A–Z).")
    if not re.search(r"[a-z]", pw):
        errors.append("Password must include at least one lowercase letter (a–z).")
    if not re.search(r"[0-9]", pw):
        errors.append("Password must include at least one number (0–9).")
    if not re.search(r"[^A-Za-z0-9]", pw):
        errors.append("Password must include at least one special character (e.g. ! @ # $ %).")

    # Must not contain the user's own identifying details — those are the first
    # things an attacker guesses.
    pw_low = pw.lower()
    tokens = []
    if email:
        tokens.append(email.lower())
        tokens.append(email.split("@")[0].lower())
    for part in (first_name, last_name, student_id):
        if part:
            tokens.append(str(part).lower())
    if any(t and len(t) >= 3 and t in pw_low for t in tokens):
        errors.append("Password must not contain your name, email, or student ID.")

    if errors:
        raise serializers.ValidationError({field: errors})
    return password
