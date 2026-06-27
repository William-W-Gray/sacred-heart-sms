"use client";

import Link from "next/link";
import { BookOpen, CalendarCheck, Trophy, GraduationCap, CreditCard } from "lucide-react";
import { useReportCard, useInvoices } from "@/hooks/useApi";
import { registrationStatus, financeTotals, money } from "@/lib/utils/finance";
import type { Student } from "@/types";

const TONE: Record<string, string> = {
  ok: "bg-[#1B6B3A]/10 text-[#1B6B3A]",
  warn: "bg-[var(--gold-pale)] text-[var(--gold-dim)]",
  err: "bg-[var(--err-bg)] text-[var(--err)]",
};

/** Compact academic + finance summary for one student. Rendered on the student
 * dashboard (own) and the guardian dashboard (per linked child). */
export function AcademicSummaryCard({ student }: { student: Student }) {
  const { data: rc, isLoading } = useReportCard(student.id);
  const { data: inv } = useInvoices({ student: student.id, page_size: 200 }, { enabled: !!student.id });

  const reg = registrationStatus(student);
  const subjects = rc?.subjects ?? [];
  const att = rc?.attendance;
  const attPct = att && att.total ? Math.round(((att.present ?? 0) / att.total) * 100) : null;
  const totals = inv ? financeTotals(inv.results ?? []) : null;

  // Recent grades: subjects that have a year average, best-effort latest few.
  const graded = subjects.filter((s) => s.year_average != null).slice(0, 4);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <GraduationCap size={15} className="text-[var(--gold-dim)]" /> {student.full_name}
        </h3>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TONE[reg.tone]}`}>{reg.label}</span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={BookOpen} label="Subjects" value={isLoading ? "…" : String(subjects.length)} />
        <Stat icon={GraduationCap} label="Class" value={student.class_name || "—"} />
        <Stat icon={CalendarCheck} label="Attendance" value={attPct != null ? `${attPct}%` : "—"} />
        <Stat icon={Trophy} label="Rank" value={rc?.ranking?.rank ? `${rc.ranking.rank}/${rc.ranking.class_size ?? "—"}` : "—"} />
      </div>

      {/* Finance summary */}
      {totals && (
        <div className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-[#5A6A8A]"><CreditCard size={14} /> Outstanding balance</span>
          <span className={`font-semibold font-mono ${totals.outstanding > 0 ? "text-[var(--err)]" : "text-[var(--ok)]"}`}>{money(totals.outstanding)}</span>
        </div>
      )}

      {/* Recent grades */}
      {graded.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Recent Grades</p>
          <div className="flex flex-wrap gap-1.5">
            {graded.map((s) => (
              <span key={s.subject} className="text-xs px-2 py-1 rounded-md bg-[var(--navy-pale)] text-navy">
                {s.subject}: <span className="font-semibold">{s.grade ?? s.year_average}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Link href="/report-cards" className="btn-outline text-xs flex-1 justify-center">Report Card</Link>
        <Link href="/my-finance" className="btn-outline text-xs flex-1 justify-center">Finance</Link>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="text-center sm:text-left">
      <p className="flex items-center gap-1 text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider justify-center sm:justify-start">
        <Icon size={11} /> {label}
      </p>
      <p className="text-sm font-semibold text-navy truncate">{value}</p>
    </div>
  );
}
