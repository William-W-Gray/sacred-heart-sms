import type { Invoice, Student } from "@/types";

/** Aggregate finance totals for a set of invoices. */
export function financeTotals(invoices: Invoice[]) {
  const assigned = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const paid = invoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const outstanding = assigned - paid;
  const overdue = invoices.filter((i) => i.status === "overdue");
  const overdueAmount = overdue.reduce(
    (s, i) => s + (Number(i.balance ?? Number(i.amount) - Number(i.amount_paid ?? 0))), 0,
  );
  return { assigned, paid, outstanding, overdueCount: overdue.length, overdueAmount };
}

/** Map a student's enrolment state to a course-registration status. */
export function registrationStatus(student?: Student | null): { label: string; tone: "ok" | "warn" | "err" } {
  if (!student) return { label: "Unknown", tone: "warn" };
  if (student.status === "active" && student.current_class) return { label: "Registered", tone: "ok" };
  if (student.status === "active" && !student.current_class) return { label: "Not Registered", tone: "err" };
  if (student.status === "suspended" || student.status === "withdrawn") return { label: "Incomplete", tone: "warn" };
  if (!student.current_class) return { label: "Pending", tone: "warn" };
  return { label: "Incomplete", tone: "warn" };
}

export const money = (n: number | string) =>
  `L$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
