"use client";
import { useState, useCallback } from "react";
import { Save } from "lucide-react";
import { useStudents, useClasses, useSubjects, useMarks, useSaveMarksBulk, useGradingScales, useAcademicYears, useSemesters, useAssessmentTemplates } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { Mark } from "@/types";

// ── Grading helper (uses DB scale) ──────────────────────────────
function getGrade(score: number | null, scale: { grade_letter: string; min_score: number; max_score: number }[]) {
  if (score === null) return null;
  return scale.find((g) => score >= g.min_score && score <= g.max_score)?.grade_letter ?? "F";
}

function safeAvg(...vals: (number | null | undefined)[]) {
  const clean = vals.filter((v) => v !== null && v !== undefined) as number[];
  if (!clean.length) return null;
  return parseFloat((clean.reduce((a, b) => a + b, 0) / clean.length).toFixed(2));
}

const GRADE_COLOR: Record<string, string> = {
  A: "text-[var(--ok)] font-bold",
  B: "text-blue-700 font-bold",
  C: "text-[var(--warn)] font-bold",
  D: "text-orange-600 font-bold",
  F: "text-[var(--err)] font-bold",
};

type MarkDraft = {
  s1id?: number;
  s2id?: number;
  s1t: number | null;
  s1e: number | null;
  s2t: number | null;
  s2e: number | null;
};

export default function MarksPage() {
  const { toast }            = useToast();
  const [selClass, setClass] = useState("");
  const [selSub,   setSub]   = useState("");
  const [drafts, setDrafts]  = useState<Record<number, MarkDraft>>({});

  const { data: years }   = useAcademicYears();
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const { data: scaleData } = useGradingScales();
  const scale = scaleData?.results ?? [];

  // Admin-defined grading templates relevant to this class/subject (or global).
  const { data: templateData } = useAssessmentTemplates({ is_active: true });
  const relevantTemplates = (templateData?.results ?? []).filter((t) =>
    (!t.class_group || String(t.class_group) === selClass) &&
    (!t.subject || String(t.subject) === selSub),
  );

  const currentYear = years?.results?.find((y) => y.is_current);
  const { data: semestersData } = useSemesters(
    currentYear ? { academic_year: currentYear.id } : undefined,
  );
  const sem1 = semestersData?.results?.find((s) => s.number === 1);
  const sem2 = semestersData?.results?.find((s) => s.number === 2);

  const { data: students, isError: studentsError, refetch: refetchStudents } = useStudents(
    selClass ? { current_class: selClass, page_size: 100 } : undefined,
  );

  const { data: marksData } = useMarks(
    selClass && selSub
      ? { student__current_class: selClass, subject: selSub, page_size: 100 }
      : undefined,
  );

  const saveMarks = useSaveMarksBulk();

  // A student has up to two separate Mark rows for a subject — one per
  // semester — not one row with four score columns, so each semester's
  // saved mark has to be looked up (and saved back) separately.
  const getMarkForStudent = (studentId: number): MarkDraft => {
    const s1Saved = sem1 && marksData?.results?.find((m: Mark) => m.student === studentId && m.semester === sem1.id);
    const s2Saved = sem2 && marksData?.results?.find((m: Mark) => m.student === studentId && m.semester === sem2.id);
    const draft = drafts[studentId];
    return {
      s1id: s1Saved?.id,
      s2id: s2Saved?.id,
      s1t: draft?.s1t !== undefined ? draft.s1t : (s1Saved?.test_score ?? null),
      s1e: draft?.s1e !== undefined ? draft.s1e : (s1Saved?.exam_score ?? null),
      s2t: draft?.s2t !== undefined ? draft.s2t : (s2Saved?.test_score ?? null),
      s2e: draft?.s2e !== undefined ? draft.s2e : (s2Saved?.exam_score ?? null),
    };
  };

  const updateDraft = useCallback((studentId: number, field: keyof MarkDraft, raw: string) => {
    const val = raw === "" ? null : parseFloat(raw);
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: val },
    }));
  }, []);

  const handleSave = async () => {
    if (!selClass || !selSub) {
      toast({ title: "Select a class and subject first", variant: "error" });
      return;
    }
    if (!sem1 && !sem2) {
      toast({ title: "No semesters found for the current academic year", variant: "error" });
      return;
    }
    const studs = students?.results ?? [];
    const records = studs.flatMap((s) => {
      const d = getMarkForStudent(s.id);
      const recs: { id?: number; student: number; subject: number; semester: number; test_score: number | null; exam_score: number | null }[] = [];
      if (sem1) {
        recs.push({ id: d.s1id, student: s.id, subject: Number(selSub), semester: sem1.id, test_score: d.s1t, exam_score: d.s1e });
      }
      if (sem2) {
        recs.push({ id: d.s2id, student: s.id, subject: Number(selSub), semester: sem2.id, test_score: d.s2t, exam_score: d.s2e });
      }
      return recs;
    });
    try {
      const res = await saveMarks.mutateAsync(records);
      setDrafts({});
      toast({ title: `Marks saved — ${res.created} created, ${res.updated} updated`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save marks"), variant: "error" });
    }
  };

  const studs = students?.results ?? [];

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Marks Entry</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">
              Test &amp; exam scores — averages and grades calculated live from the DB grading scale
            </p>
          </div>
          <button onClick={handleSave} disabled={saveMarks.isPending} className="btn-gold flex items-center gap-2 disabled:opacity-60">
            <Save size={15} />
            {saveMarks.isPending ? "Saving…" : "Save Marks"}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap mt-4">
          <select value={selClass} onChange={(e) => setClass(e.target.value)} className="form-input w-full sm:w-40 text-sm">
            <option value="">Select Class</option>
            {classes?.results?.map((c) => (
              <option key={c.id} value={c.id}>Grade {c.name}</option>
            ))}
          </select>
          <select value={selSub} onChange={(e) => setSub(e.target.value)} className="form-input w-full sm:w-52 text-sm">
            <option value="">Select Subject</option>
            {subjects?.results?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span className="form-input w-full sm:w-36 text-sm bg-[var(--surface)] text-[#5A6A8A] cursor-default">
            {currentYear?.name ?? "2025/2026"}
          </span>
        </div>
      </div>

      <div className="page-content space-y-5">
        {selClass && selSub && relevantTemplates.length > 0 && (
          <div className="card px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider mr-1">Grading template:</span>
              {relevantTemplates.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-navy-pale border border-navy/15 px-2.5 py-1 text-xs text-navy">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-[#5A6A8A]">· {t.kind_display} · max {t.max_score}{Number(t.weight) > 0 ? ` · ${t.weight}%` : ""}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {!selClass || !selSub ? (
          <div className="card flex flex-col items-center justify-center h-64 text-[#8A9ABB]">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-medium">Select a class and subject to begin</p>
            <p className="text-sm mt-1">Marks will load automatically</p>
          </div>
        ) : studentsError ? (
          <div className="card">
            <QueryError resource="students" onRetry={refetchStudents} />
          </div>
        ) : studs.length === 0 ? (
          <div className="card flex flex-col items-center justify-center h-48 text-[#8A9ABB]">
            <p>No students in this class</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[800px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)] w-8">#</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">Student</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">ID</th>
                    <th colSpan={3} className="text-center px-4 py-2 text-[11px] font-semibold text-navy uppercase tracking-wider border-b border-[var(--border)] bg-navy/5">
                      SEMESTER 1
                    </th>
                    <th colSpan={3} className="text-center px-4 py-2 text-[11px] font-semibold text-[var(--gold-dim)] uppercase tracking-wider border-b border-[var(--border)] bg-[var(--gold-pale)]">
                      SEMESTER 2
                    </th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">Year Avg</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">Grade</th>
                  </tr>
                  <tr>
                    <th className="border-b border-[var(--border)]" colSpan={3} />
                    <th className="px-3 py-2 text-[10px] text-[#5A6A8A] border-b border-[var(--border)] bg-navy/5 font-medium">Test</th>
                    <th className="px-3 py-2 text-[10px] text-[#5A6A8A] border-b border-[var(--border)] bg-navy/5 font-medium">Exam</th>
                    <th className="px-3 py-2 text-[10px] text-[#5A6A8A] border-b border-[var(--border)] bg-navy/5 font-medium">Avg</th>
                    <th className="px-3 py-2 text-[10px] text-[var(--gold-dim)] border-b border-[var(--border)] bg-[var(--gold-pale)] font-medium">Test</th>
                    <th className="px-3 py-2 text-[10px] text-[var(--gold-dim)] border-b border-[var(--border)] bg-[var(--gold-pale)] font-medium">Exam</th>
                    <th className="px-3 py-2 text-[10px] text-[var(--gold-dim)] border-b border-[var(--border)] bg-[var(--gold-pale)] font-medium">Avg</th>
                    <th colSpan={2} className="border-b border-[var(--border)]" />
                  </tr>
                </thead>
                <tbody>
                  {studs.map((student, idx) => {
                    const m    = getMarkForStudent(student.id);
                    const s1a  = safeAvg(m.s1t, m.s1e);
                    const s2a  = safeAvg(m.s2t, m.s2e);
                    const ya   = safeAvg(s1a, s2a);
                    const gl   = getGrade(ya, scale);
                    return (
                      <tr key={student.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                        <td className="px-4 py-2.5 text-[#8A9ABB] text-xs">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-navy">{student.full_name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#5A6A8A]">{student.student_id}</td>
                        {/* S1 Test */}
                        <td className="px-2 py-2 bg-navy/[0.02]">
                          <input
                            type="number" min={0} max={100} step={0.5}
                            value={m.s1t ?? ""}
                            disabled={!sem1}
                            title={!sem1 ? "Semester 1 hasn't been created yet for this academic year" : undefined}
                            onChange={(e) => updateDraft(student.id, "s1t", e.target.value)}
                            className="w-16 px-2 py-1 text-center text-sm border border-[var(--border-strong)] rounded font-mono bg-white focus:border-navy focus:ring-1 focus:ring-navy/10 outline-none disabled:bg-[var(--surface)] disabled:cursor-not-allowed"
                          />
                        </td>
                        {/* S1 Exam */}
                        <td className="px-2 py-2 bg-navy/[0.02]">
                          <input
                            type="number" min={0} max={100} step={0.5}
                            value={m.s1e ?? ""}
                            disabled={!sem1}
                            title={!sem1 ? "Semester 1 hasn't been created yet for this academic year" : undefined}
                            onChange={(e) => updateDraft(student.id, "s1e", e.target.value)}
                            className="w-16 px-2 py-1 text-center text-sm border border-[var(--border-strong)] rounded font-mono bg-white focus:border-navy focus:ring-1 focus:ring-navy/10 outline-none disabled:bg-[var(--surface)] disabled:cursor-not-allowed"
                          />
                        </td>
                        {/* S1 Avg */}
                        <td className="px-3 py-2 text-center text-sm font-mono font-semibold bg-navy/[0.02] text-navy">
                          {s1a !== null ? s1a.toFixed(1) : "—"}
                        </td>
                        {/* S2 Test */}
                        <td className="px-2 py-2 bg-[var(--gold-pale)]">
                          <input
                            type="number" min={0} max={100} step={0.5}
                            value={m.s2t ?? ""}
                            disabled={!sem2}
                            title={!sem2 ? "Semester 2 hasn't been created yet for this academic year" : undefined}
                            onChange={(e) => updateDraft(student.id, "s2t", e.target.value)}
                            className="w-16 px-2 py-1 text-center text-sm border border-[var(--border-strong)] rounded font-mono bg-white focus:border-navy outline-none disabled:bg-[var(--surface)] disabled:cursor-not-allowed"
                          />
                        </td>
                        {/* S2 Exam */}
                        <td className="px-2 py-2 bg-[var(--gold-pale)]">
                          <input
                            type="number" min={0} max={100} step={0.5}
                            value={m.s2e ?? ""}
                            disabled={!sem2}
                            title={!sem2 ? "Semester 2 hasn't been created yet for this academic year" : undefined}
                            onChange={(e) => updateDraft(student.id, "s2e", e.target.value)}
                            className="w-16 px-2 py-1 text-center text-sm border border-[var(--border-strong)] rounded font-mono bg-white focus:border-navy outline-none disabled:bg-[var(--surface)] disabled:cursor-not-allowed"
                          />
                        </td>
                        {/* S2 Avg */}
                        <td className="px-3 py-2 text-center text-sm font-mono font-semibold bg-[var(--gold-pale)] text-[var(--gold-dim)]">
                          {s2a !== null ? s2a.toFixed(1) : "—"}
                        </td>
                        {/* Year Avg */}
                        <td className="px-3 py-2 text-center text-sm font-mono font-bold text-navy">
                          {ya !== null ? ya.toFixed(1) : "—"}
                        </td>
                        {/* Grade */}
                        <td className="px-3 py-2 text-center">
                          {gl ? (
                            <span className={`text-sm ${GRADE_COLOR[gl] ?? ""}`}>{gl}</span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grading scale display */}
        {scale.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-navy">Grading Scale</h3>
              <span className="badge-navy text-[10px]">Configurable in Settings</span>
            </div>
            <div className="flex gap-3 flex-wrap">
              {scale.map((g) => (
                <div
                  key={g.id}
                  className={`px-4 py-2 rounded-md text-center border ${
                    g.grade_letter === "A" ? "bg-[var(--ok-bg)] border-[var(--ok-border)]" :
                    g.grade_letter === "B" ? "bg-navy-pale border-navy/15" :
                    g.grade_letter === "C" ? "bg-[var(--warn-bg)] border-[var(--warn-border)]" :
                    g.grade_letter === "D" ? "bg-orange-50 border-orange-200" :
                    "bg-[var(--err-bg)] border-[var(--err-border)]"
                  }`}
                >
                  <div className={`text-lg ${GRADE_COLOR[g.grade_letter] ?? ""}`}>{g.grade_letter}</div>
                  <div className="text-[11px] text-[#5A6A8A] mt-0.5">{g.min_score}–{g.max_score}</div>
                  <div className="text-[10px] text-[#8A9ABB]">{g.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
