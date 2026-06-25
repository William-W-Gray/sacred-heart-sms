"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";
import {
  useAssessmentTemplates, useCreateAssessmentTemplate, useUpdateAssessmentTemplate,
  useDeleteAssessmentTemplate, useAcademicYears, useSemesters, useClasses, useSubjects,
} from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { AssessmentTemplate, AssessmentKind } from "@/lib/api/services";

const KINDS: { value: AssessmentKind; label: string }[] = [
  { value: "assignment", label: "Assignment / Homework" },
  { value: "quiz",       label: "Quiz" },
  { value: "test",       label: "Test" },
  { value: "exam",       label: "Exam" },
];

type Draft = {
  id?: number;
  name: string;
  kind: AssessmentKind;
  academic_year: string;
  semester: string;
  class_group: string;
  subject: string;
  max_score: string;
  weight: string;
  is_active: boolean;
};

const emptyDraft = (defaultYear = ""): Draft => ({
  name: "", kind: "test", academic_year: defaultYear, semester: "",
  class_group: "", subject: "", max_score: "100", weight: "0", is_active: true,
});

export function GradingTemplatesSection() {
  const { toast } = useToast();
  const { data, isError, refetch } = useAssessmentTemplates();
  const { data: years }    = useAcademicYears();
  const { data: semesters } = useSemesters();
  const { data: classes }  = useClasses();
  const { data: subjects } = useSubjects();

  const createT = useCreateAssessmentTemplate();
  const updateT = useUpdateAssessmentTemplate();
  const deleteT = useDeleteAssessmentTemplate();

  const templates = data?.results ?? [];
  const currentYearId = years?.results?.find((y) => y.is_current)?.id;

  const [draft, setDraft] = useState<Draft | null>(null);

  const openAdd  = () => setDraft(emptyDraft(currentYearId ? String(currentYearId) : ""));
  const openEdit = (t: AssessmentTemplate) => setDraft({
    id: t.id, name: t.name, kind: t.kind,
    academic_year: String(t.academic_year),
    semester: t.semester ? String(t.semester) : "",
    class_group: t.class_group ? String(t.class_group) : "",
    subject: t.subject ? String(t.subject) : "",
    max_score: String(t.max_score), weight: String(t.weight), is_active: t.is_active,
  });

  const setField = (k: keyof Draft, v: string | boolean) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { toast({ title: "Template name is required", variant: "error" }); return; }
    if (!draft.academic_year) { toast({ title: "Academic year is required", variant: "error" }); return; }
    const max = Number(draft.max_score);
    if (!(max > 0)) { toast({ title: "Max score must be greater than zero", variant: "error" }); return; }

    const payload: Partial<AssessmentTemplate> = {
      name: draft.name.trim(),
      kind: draft.kind,
      academic_year: Number(draft.academic_year),
      semester: draft.semester ? Number(draft.semester) : null,
      class_group: draft.class_group ? Number(draft.class_group) : null,
      subject: draft.subject ? Number(draft.subject) : null,
      max_score: max,
      weight: Number(draft.weight) || 0,
      is_active: draft.is_active,
    };
    try {
      if (draft.id) await updateT.mutateAsync({ id: draft.id, data: payload });
      else await createT.mutateAsync(payload);
      toast({ title: `Template ${draft.id ? "updated" : "created"}`, variant: "success" });
      setDraft(null);
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save template"), variant: "error" });
    }
  };

  const handleDelete = async (t: AssessmentTemplate) => {
    if (!confirm(`Delete template "${t.name}"? It will move to Trash and can be restored.`)) return;
    try {
      await deleteT.mutateAsync(t.id);
      toast({ title: "Template moved to Trash", variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to delete template"), variant: "error" });
    }
  };

  const saving = createT.isPending || updateT.isPending;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-navy">Grading Templates</h3>
          <p className="text-xs text-[#5A6A8A] mt-0.5">
            Define the assessments teachers grade against. Scope to a class/subject/semester, or leave blank for all.
          </p>
        </div>
        {!draft && (
          <button onClick={openAdd} className="btn-gold flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Plus size={13} /> Add Template
          </button>
        )}
      </div>

      {/* Inline editor */}
      {draft && (
        <div className="mt-4 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-navy uppercase tracking-wider">
              {draft.id ? "Edit Template" : "New Template"}
            </h4>
            <button onClick={() => setDraft(null)} className="p-1 rounded hover:bg-white text-[#5A6A8A]"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Name">
              <input value={draft.name} onChange={(e) => setField("name", e.target.value)} className="form-input text-sm" placeholder="e.g. Mid-Term Test" />
            </Field>
            <Field label="Type">
              <select value={draft.kind} onChange={(e) => setField("kind", e.target.value)} className="form-input text-sm">
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </Field>
            <Field label="Academic Year">
              <select value={draft.academic_year} onChange={(e) => setField("academic_year", e.target.value)} className="form-input text-sm">
                <option value="">Select…</option>
                {years?.results?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </Field>
            <Field label="Semester (optional)">
              <select value={draft.semester} onChange={(e) => setField("semester", e.target.value)} className="form-input text-sm">
                <option value="">All semesters</option>
                {semesters?.results?.map((s) => <option key={s.id} value={s.id}>Semester {s.number}</option>)}
              </select>
            </Field>
            <Field label="Class (optional)">
              <select value={draft.class_group} onChange={(e) => setField("class_group", e.target.value)} className="form-input text-sm">
                <option value="">All classes</option>
                {classes?.results?.map((c) => <option key={c.id} value={c.id}>Grade {c.name}</option>)}
              </select>
            </Field>
            <Field label="Subject (optional)">
              <select value={draft.subject} onChange={(e) => setField("subject", e.target.value)} className="form-input text-sm">
                <option value="">All subjects</option>
                {subjects?.results?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Max Score">
              <input type="number" min={1} step="0.5" value={draft.max_score} onChange={(e) => setField("max_score", e.target.value)} className="form-input text-sm" />
            </Field>
            <Field label="Weight %">
              <input type="number" min={0} max={100} step="1" value={draft.weight} onChange={(e) => setField("weight", e.target.value)} className="form-input text-sm" />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 text-sm text-navy h-[38px]">
                <input type="checkbox" checked={draft.is_active} onChange={(e) => setField("is_active", e.target.checked)} />
                Active
              </label>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDraft(null)} className="btn-outline text-xs px-3 py-1.5">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-gold flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-60">
              <Save size={13} /> {saving ? "Saving…" : "Save Template"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-4">
        {isError ? (
          <QueryError resource="grading templates" onRetry={refetch} />
        ) : templates.length === 0 ? (
          <p className="text-sm text-[#8A9ABB] text-center py-6">No grading templates yet. Add one to define your assessment structure.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {["Name", "Type", "Scope", "Max", "Weight", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-3 font-medium text-navy">{t.name}</td>
                    <td className="px-3 py-3"><span className="badge-navy">{t.kind_display}</span></td>
                    <td className="px-3 py-3 text-[#5A6A8A] text-xs">
                      {[t.class_name && `Grade ${t.class_name}`, t.subject_name, t.semester ? `Sem ${t.semester}` : null]
                        .filter(Boolean).join(" · ") || "All"}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-navy">{t.max_score}</td>
                    <td className="px-3 py-3 font-mono text-xs text-[#5A6A8A]">{t.weight}%</td>
                    <td className="px-3 py-3">
                      {t.is_active
                        ? <span className="badge-ok text-[10px]">Active</span>
                        : <span className="badge-gray text-[10px]">Inactive</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-[var(--surface2)] text-[#5A6A8A] hover:text-navy" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(t)} className="p-1.5 rounded hover:bg-[var(--err-bg)] text-[#5A6A8A] hover:text-[var(--err)]" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}
