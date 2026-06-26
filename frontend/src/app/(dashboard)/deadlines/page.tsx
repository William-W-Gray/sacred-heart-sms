"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Clock, Lock, Pencil, X } from "lucide-react";
import {
  useTaskWindows, useCreateTaskWindow, useUpdateTaskWindow, useDeleteTaskWindow,
  useClasses, useSubjects, useTeachers, useAcademicYears, useSemesters,
} from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { AcademicTaskWindow, TaskType, WindowStatus } from "@/lib/api/services";

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "attendance",     label: "Attendance" },
  { value: "assignment",     label: "Assignment / Homework" },
  { value: "quiz",           label: "Quiz Marks" },
  { value: "test",           label: "Test Marks" },
  { value: "exam",           label: "Exam Marks" },
  { value: "conduct",        label: "Conduct Entry" },
  { value: "report_comment", label: "Report Card Comments" },
];
const STATUSES: { value: WindowStatus; label: string }[] = [
  { value: "auto",     label: "Automatic (by date/time)" },
  { value: "open",     label: "Open" },
  { value: "closed",   label: "Closed" },
  { value: "readonly", label: "Read-Only" },
];

type FormState = {
  task_type: TaskType;
  academic_year: number | "";
  semester: number | "";
  assigned_class: number | "";
  subject: number | "";
  teacher: number | "";
  open_at: string;
  close_at: string;
  status: WindowStatus;
  note: string;
};

const blankForm = (year: number | ""): FormState => ({
  task_type: "attendance", academic_year: year, semester: "", assigned_class: "",
  subject: "", teacher: "", open_at: "", close_at: "", status: "auto", note: "",
});

// "2026-06-26T14:30:00Z" → "2026-06-26T14:30" for <input type=datetime-local>
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

function StatusPill({ s }: { s: AcademicTaskWindow["effective_status"] }) {
  const map = {
    open:     "bg-[var(--ok-bg,#E8F5E9)] text-[var(--ok,#2E7D32)] border-[rgba(46,125,50,0.25)]",
    closed:   "bg-[var(--err-bg)] text-[var(--err)] border-[var(--err-border)]",
    readonly: "bg-[var(--gold-pale)] text-[var(--gold-dim)] border-[rgba(200,168,75,0.3)]",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${map[s]}`}>
      {s === "open" ? <Clock size={10} /> : <Lock size={10} />}{s}
    </span>
  );
}

export default function DeadlinesPage() {
  const { toast } = useToast();
  const { data: windows, isError, refetch } = useTaskWindows();
  const { data: classes }  = useClasses();
  const { data: subjects } = useSubjects();
  const { data: teachers } = useTeachers();
  const { data: years }    = useAcademicYears();
  const { data: semesters } = useSemesters();

  const createWin = useCreateTaskWindow();
  const updateWin = useUpdateTaskWindow();
  const deleteWin = useDeleteTaskWindow();

  const currentYear = useMemo(
    () => years?.results?.find((y) => y.is_current)?.id ?? years?.results?.[0]?.id ?? "",
    [years],
  );
  const [form, setForm] = useState<FormState>(() => blankForm(""));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const openCreate = () => { setForm(blankForm(currentYear)); setEditingId(null); setShowForm(true); };
  const openEdit = (w: AcademicTaskWindow) => {
    setForm({
      task_type: w.task_type, academic_year: w.academic_year, semester: w.semester ?? "",
      assigned_class: w.assigned_class ?? "", subject: w.subject ?? "", teacher: w.teacher ?? "",
      open_at: toLocalInput(w.open_at), close_at: toLocalInput(w.close_at), status: w.status, note: w.note,
    });
    setEditingId(w.id); setShowForm(true);
  };

  const submit = async () => {
    if (!form.academic_year) { toast({ title: "Academic year is required", variant: "error" }); return; }
    const payload = {
      task_type: form.task_type,
      academic_year: Number(form.academic_year),
      semester: form.semester ? Number(form.semester) : null,
      assigned_class: form.assigned_class ? Number(form.assigned_class) : null,
      subject: form.subject ? Number(form.subject) : null,
      teacher: form.teacher ? Number(form.teacher) : null,
      open_at: form.open_at ? form.open_at : null,
      close_at: form.close_at ? form.close_at : null,
      status: form.status,
      note: form.note,
    };
    try {
      if (editingId) {
        await updateWin.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Deadline window updated · teachers notified", variant: "success" });
      } else {
        await createWin.mutateAsync(payload);
        toast({ title: "Deadline window created · teachers notified", variant: "success" });
      }
      setShowForm(false); setEditingId(null);
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save deadline window"), variant: "error" });
    }
  };

  const quickStatus = async (w: AcademicTaskWindow, status: WindowStatus) => {
    try {
      await updateWin.mutateAsync({ id: w.id, data: { status } });
      toast({ title: `Marked ${status} · teachers notified`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to update status"), variant: "error" });
    }
  };

  const remove = async (w: AcademicTaskWindow) => {
    if (!confirm(`Delete this ${w.task_type_display} window? Teachers will be unrestricted for this scope.`)) return;
    try { await deleteWin.mutateAsync(w.id); toast({ title: "Window deleted", variant: "success" }); }
    catch (err) { toast({ title: getApiErrorMessage(err, "Failed to delete"), variant: "error" }); }
  };

  const rows = windows?.results ?? [];
  const saving = createWin.isPending || updateWin.isPending;

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Academic Deadlines</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">Control when teachers can record attendance, marks &amp; conduct. No window = unrestricted.</p>
          </div>
          <button onClick={openCreate} className="btn-gold flex items-center gap-2">
            <Plus size={15} /> New Deadline
          </button>
        </div>
      </div>

      <div className="page-content space-y-5">
        {showForm && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-navy">{editingId ? "Edit deadline window" : "New deadline window"}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-ghost p-1.5" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Task type *</label>
                <select className="form-input text-sm" value={form.task_type} onChange={(e) => setForm(f => ({ ...f, task_type: e.target.value as TaskType }))}>
                  {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Academic year *</label>
                <select className="form-input text-sm" value={form.academic_year} onChange={(e) => setForm(f => ({ ...f, academic_year: e.target.value ? Number(e.target.value) : "" }))}>
                  <option value="">Select…</option>
                  {years?.results?.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Semester</label>
                <select className="form-input text-sm" value={form.semester} onChange={(e) => setForm(f => ({ ...f, semester: e.target.value ? Number(e.target.value) : "" }))}>
                  <option value="">All semesters</option>
                  {semesters?.results?.map(s => <option key={s.id} value={s.id}>Semester {s.number}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Class</label>
                <select className="form-input text-sm" value={form.assigned_class} onChange={(e) => setForm(f => ({ ...f, assigned_class: e.target.value ? Number(e.target.value) : "" }))}>
                  <option value="">All classes</option>
                  {classes?.results?.map(c => <option key={c.id} value={c.id}>Grade {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Subject</label>
                <select className="form-input text-sm" value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value ? Number(e.target.value) : "" }))}>
                  <option value="">All subjects</option>
                  {subjects?.results?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Teacher</label>
                <select className="form-input text-sm" value={form.teacher} onChange={(e) => setForm(f => ({ ...f, teacher: e.target.value ? Number(e.target.value) : "" }))}>
                  <option value="">All teachers</option>
                  {teachers?.results?.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Opens at</label>
                <input type="datetime-local" className="form-input text-sm" value={form.open_at} onChange={(e) => setForm(f => ({ ...f, open_at: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Closes at</label>
                <input type="datetime-local" className="form-input text-sm" value={form.close_at} onChange={(e) => setForm(f => ({ ...f, close_at: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-input text-sm" value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as WindowStatus }))}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="form-label">Note (shown to teachers)</label>
                <input className="form-input text-sm" value={form.note} maxLength={255} placeholder="e.g. Submit Semester 2 test scores by Friday" onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-[#8A9ABB] mt-3">
              Leave Class / Subject / Teacher blank to apply to all. With <strong>Automatic</strong> status, the open/close times decide; the most specific matching window wins.
            </p>
            <div className="flex gap-2 mt-4">
              <button onClick={submit} disabled={saving} className="btn-gold text-sm px-4 py-2 disabled:opacity-60">
                {saving ? "Saving…" : editingId ? "Save changes" : "Create window"}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-navy">Configured windows</h3>
            <p className="text-xs text-[#5A6A8A] mt-0.5">{rows.length} window{rows.length === 1 ? "" : "s"}</p>
          </div>
          {isError ? (
            <QueryError resource="deadlines" onRetry={refetch} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[860px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Task", "Scope", "Window", "Status", "Set status", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w) => (
                    <tr key={w.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                      <td className="px-4 py-3 font-medium text-navy whitespace-nowrap">{w.task_type_display}</td>
                      <td className="px-4 py-3 text-[#5A6A8A] text-xs">
                        {[w.class_name ? `Grade ${w.class_name}` : "All classes", w.subject_name ?? "All subjects", w.teacher_name ?? "All teachers"].join(" · ")}
                        {w.note && <div className="text-[11px] text-[#8A9ABB] italic mt-0.5">“{w.note}”</div>}
                      </td>
                      <td className="px-4 py-3 text-[#5A6A8A] text-xs whitespace-nowrap">
                        {w.open_at ? new Date(w.open_at).toLocaleString() : "—"}<br />
                        <span className="text-[#8A9ABB]">→ {w.close_at ? new Date(w.close_at).toLocaleString() : "—"}</span>
                      </td>
                      <td className="px-4 py-3"><StatusPill s={w.effective_status} /></td>
                      <td className="px-4 py-3">
                        <select
                          value={w.status}
                          onChange={(e) => quickStatus(w, e.target.value as WindowStatus)}
                          className="form-input text-xs py-1.5 w-32"
                          title="Reopen / close / extend"
                        >
                          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label.split(" ")[0]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => openEdit(w)} className="text-[#8A9ABB] hover:text-navy transition-colors p-1" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => remove(w)} className="text-[#8A9ABB] hover:text-[var(--err)] transition-colors p-1 ml-1" title="Delete"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-[#8A9ABB] text-sm">
                      No deadline windows yet. Teachers can currently record everything they&apos;re assigned to.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
