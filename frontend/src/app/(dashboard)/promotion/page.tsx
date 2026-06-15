"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import { useStudents, usePromotions, useUpsertPromotion, useClasses } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import type { PromotionDecisionType } from "@/types";

const DECISION_OPTIONS: { value: PromotionDecisionType; label: string }[] = [
  { value: "promoted",      label: "✓ Promoted" },
  { value: "conditioned",   label: "Conditioned" },
  { value: "retained",      label: "Retained" },
  { value: "not_returning", label: "Not Returning" },
];

const DECISION_COLORS: Record<PromotionDecisionType, string> = {
  promoted:      "border-[var(--ok)] bg-[var(--ok-bg)]",
  conditioned:   "border-[var(--warn)] bg-[var(--warn-bg)]",
  retained:      "border-crimson-light bg-[var(--err-bg)]",
  not_returning: "border-[var(--border-strong)] bg-[var(--surface)]",
};

export default function PromotionPage() {
  const { toast }                 = useToast();
  const [selClass,  setClass]     = useState("");
  const [decisions, setDecisions] = useState<Record<number, PromotionDecisionType | "">>({});
  const [notes,     setNotes]     = useState<Record<number, string>>({});

  const { data: classes }    = useClasses();
  const { data: students }   = useStudents(selClass ? { current_class: selClass, status: "active", page_size: 100 } : undefined);
  const { data: promoData }  = usePromotions(selClass ? { current_class: selClass, page_size: 100 } : undefined);
  const upsertPromo          = useUpsertPromotion();

  const studs  = students?.results ?? [];
  const promos = promoData?.results ?? [];

  const getDecision = (studentId: number): PromotionDecisionType | "" => {
    if (decisions[studentId] !== undefined) return decisions[studentId];
    return (promos.find((p) => p.student === studentId)?.decision as PromotionDecisionType) ?? "";
  };

  const getNote = (studentId: number): string => {
    if (notes[studentId] !== undefined) return notes[studentId];
    return promos.find((p) => p.student === studentId)?.reason ?? "";
  };

  const counts = {
    promoted:      studs.filter((s) => getDecision(s.id) === "promoted").length,
    conditioned:   studs.filter((s) => getDecision(s.id) === "conditioned").length,
    retained:      studs.filter((s) => getDecision(s.id) === "retained").length,
    not_returning: studs.filter((s) => getDecision(s.id) === "not_returning").length,
    undecided:     studs.filter((s) => !getDecision(s.id)).length,
  };

  const handleSave = async () => {
    if (!selClass) { toast({ title: "Select a class first", variant: "error" }); return; }
    let saved = 0;
    for (const student of studs) {
      const decision = getDecision(student.id);
      if (!decision) continue;
      try {
        const existing = promos.find((p) => p.student === student.id);
        await upsertPromo.mutateAsync({
          id:           existing?.id,
          student:      student.id,
          current_class: student.current_class ?? Number(selClass),
          decision,
          reason: getNote(student.id),
        });
        saved++;
      } catch { /* continue for others */ }
    }
    setDecisions({});
    setNotes({});
    toast({ title: `${saved} promotion decisions saved`, variant: "success" });
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Year-End Promotion Decisions</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">Review and confirm promotion status for all students</p>
          </div>
          <button
            onClick={handleSave}
            disabled={upsertPromo.isPending || !selClass}
            className="btn-gold flex items-center gap-2 disabled:opacity-60"
          >
            <Save size={15} />
            {upsertPromo.isPending ? "Saving…" : "Save All Decisions"}
          </button>
        </div>

        <div className="mt-4">
          <select value={selClass} onChange={(e) => { setClass(e.target.value); setDecisions({}); setNotes({}); }} className="form-input w-44 text-sm">
            <option value="">Select Class</option>
            {classes?.results?.map((c) => <option key={c.id} value={c.id}>Grade {c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="page-content space-y-5">
        {/* Summary stats */}
        {selClass && studs.length > 0 && (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Promoted",      value: counts.promoted,      cls: "from-[#1B6B3A] to-[#2A9D5C]" },
              { label: "Conditioned",   value: counts.conditioned,   cls: "from-[#C8A84B] to-[#E8C96A]" },
              { label: "Retained",      value: counts.retained,      cls: "from-crimson to-crimson-light" },
              { label: "Not Returning", value: counts.not_returning,  cls: "from-navy to-navy-light" },
              { label: "Undecided",     value: counts.undecided,      cls: "from-[#8A9ABB] to-[#5A6A8A]" },
            ].map((s) => (
              <div key={s.label} className="card relative overflow-hidden pt-0.5">
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${s.cls}`} />
                <div className="p-4 text-center">
                  <p className="text-xs text-[#5A6A8A] mb-1">{s.label}</p>
                  <p className="text-2xl font-semibold text-navy font-mono">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!selClass ? (
          <div className="card flex flex-col items-center justify-center h-64 text-[#8A9ABB]">
            <div className="text-4xl mb-3">🏆</div>
            <p className="font-medium">Select a class to manage promotion decisions</p>
          </div>
        ) : studs.length === 0 ? (
          <div className="card flex items-center justify-center h-48 text-[#8A9ABB] text-sm">
            No active students in this class
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Student", "Class", "Year Avg", "Att%", "Decision", "Note"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {studs.map((student) => {
                    const decision = getDecision(student.id);
                    return (
                      <tr key={student.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-navy-pale flex items-center justify-center text-navy font-semibold text-xs flex-shrink-0">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                            <div>
                              <p className="font-medium text-navy">{student.full_name}</p>
                              <p className="text-xs text-[#5A6A8A] font-mono">{student.student_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge-navy">{student.class_name ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-[#5A6A8A]">—</td>
                        <td className="px-4 py-3 text-[#5A6A8A] text-sm">—</td>
                        <td className="px-4 py-3">
                          <select
                            value={decision}
                            onChange={(e) => setDecisions((prev) => ({ ...prev, [student.id]: e.target.value as PromotionDecisionType }))}
                            className={`text-xs px-2.5 py-2 rounded border transition-colors outline-none font-medium w-44 ${
                              decision ? DECISION_COLORS[decision as PromotionDecisionType] : "border-[var(--border-strong)] bg-white text-[#5A6A8A]"
                            }`}
                          >
                            <option value="">— Decide —</option>
                            {DECISION_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={getNote(student.id)}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))}
                            placeholder="Optional note…"
                            className="form-input text-xs w-40"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
