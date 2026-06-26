"use client";
import { Timer, Lock, Clock } from "lucide-react";
import { useTaskWindows } from "@/hooks/useApi";
import type { AcademicTaskWindow } from "@/lib/api/services";

const fmtCountdown = (iso: string | null): string | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "deadline passed";
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `closes in ${days}d ${hrs % 24}h`;
  if (hrs > 0) return `closes in ${hrs}h ${mins % 60}m`;
  return `closes in ${mins}m`;
};

const scopeLabel = (w: AcademicTaskWindow) =>
  [w.class_name ? `Grade ${w.class_name}` : "All classes", w.subject_name ?? "All subjects"].join(" · ");

function StatusPill({ s }: { s: AcademicTaskWindow["effective_status"] }) {
  const map = {
    open:     "bg-[var(--ok-bg)] text-[var(--ok)] border-[rgba(46,125,50,0.25)]",
    closed:   "bg-[var(--err-bg)] text-[var(--err)] border-[var(--err-border)]",
    readonly: "bg-[var(--gold-pale)] text-[var(--gold-dim)] border-[rgba(200,168,75,0.3)]",
  } as const;
  const label = s === "open" ? "Open" : s === "readonly" ? "Read-only" : "Locked";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${map[s]}`}>
      {s === "open" ? <Clock size={10} /> : <Lock size={10} />}{label}
    </span>
  );
}

export function TeacherDeadlinesCard() {
  const { data } = useTaskWindows();
  const rows = (data?.results ?? []).slice(0, 6);

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-navy flex items-center gap-2">
          <Timer size={17} className="text-[var(--gold-dim)]" /> Academic Tasks &amp; Deadlines
        </h3>
        <span className="text-[11px] text-[var(--muted)] font-medium">{rows.length} active</span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {rows.map((w) => {
          const countdown = w.effective_status === "open" ? fmtCountdown(w.close_at) : null;
          return (
            <div key={w.id} className="px-6 py-3.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">{w.task_type_display}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{scopeLabel(w)}</p>
                {w.note && <p className="text-[11px] text-[#8A9ABB] italic mt-1">“{w.note}”</p>}
                {w.effective_status !== "open" && (
                  <p className="text-[11px] text-[var(--err)] mt-1">
                    This task is {w.effective_status === "readonly" ? "read-only" : "locked"}. Contact the Admin to make changes.
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <StatusPill s={w.effective_status} />
                {countdown && <span className="text-[10px] text-[var(--gold-dim)] font-medium whitespace-nowrap">{countdown}</span>}
              </div>
            </div>
          );
        })}
        {!rows.length && (
          <div className="px-6 py-8 text-center text-[#8A9ABB] text-sm">
            No deadlines set — you can record everything you&apos;re assigned to.
          </div>
        )}
      </div>
    </div>
  );
}
