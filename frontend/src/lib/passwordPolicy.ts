// Mirror of the backend password policy (apps/users/password_validation.py).
// Used for instant, friendly feedback before the request is sent — the server
// still enforces the same rules as the source of truth.

export interface PasswordContext {
  email?: string;
  firstName?: string;
  lastName?: string;
  studentId?: string;
}

export interface PasswordRule {
  label: string;
  ok: boolean;
}

/** Returns each rule with whether the password currently satisfies it. */
export function passwordRules(pw: string, ctx: PasswordContext = {}): PasswordRule[] {
  const lower = pw.toLowerCase();
  const tokens: string[] = [];
  if (ctx.email) {
    tokens.push(ctx.email.toLowerCase());
    tokens.push(ctx.email.split("@")[0].toLowerCase());
  }
  for (const part of [ctx.firstName, ctx.lastName, ctx.studentId]) {
    if (part) tokens.push(part.toLowerCase());
  }
  const containsPersonal = tokens.some((t) => t.length >= 3 && lower.includes(t));

  return [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "One uppercase letter (A–Z)", ok: /[A-Z]/.test(pw) },
    { label: "One lowercase letter (a–z)", ok: /[a-z]/.test(pw) },
    { label: "One number (0–9)", ok: /[0-9]/.test(pw) },
    { label: "One special character (! @ # $ %)", ok: /[^A-Za-z0-9]/.test(pw) },
    { label: "Not your name, email, or student ID", ok: pw.length > 0 && !containsPersonal },
  ];
}

/** First unmet-rule message, or null when the password satisfies the policy. */
export function passwordError(pw: string, ctx: PasswordContext = {}): string | null {
  const failed = passwordRules(pw, ctx).find((r) => !r.ok);
  return failed ? `Password must satisfy: ${failed.label}.` : null;
}
