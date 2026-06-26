import { Check, X } from "lucide-react";
import { passwordRules, type PasswordContext } from "@/lib/passwordPolicy";

// Live checklist of the password policy. Only worth showing once the user has
// started typing — an all-red list under an empty field reads as an error.
export function PasswordChecklist({ password, ctx }: { password: string; ctx?: PasswordContext }) {
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1">
      {passwordRules(password, ctx).map((rule) => (
        <li
          key={rule.label}
          className={`flex items-center gap-1.5 text-xs ${rule.ok ? "text-[#1B6B3A]" : "text-[var(--muted)]"}`}
        >
          {rule.ok ? <Check size={13} /> : <X size={13} className="text-[#8B1A1A]/60" />}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
