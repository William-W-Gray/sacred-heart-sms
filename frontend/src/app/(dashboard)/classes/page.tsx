"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useClasses, useSubjects, useCreateClass, useCreateSubject, useDeleteSubject } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";

export default function ClassesPage() {
  const { toast } = useToast();
  const { data: classes,  isError: classesError,  refetch: refetchClasses  } = useClasses();
  const { data: subjects, isError: subjectsError, refetch: refetchSubjects } = useSubjects();
  const createClass   = useCreateClass();
  const createSubject = useCreateSubject();
  const deleteSubject = useDeleteSubject();

  const [classForm,   setClassForm]   = useState({ grade: "12", section: "A" });
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "" });
  const [showClassForm,   setShowClassForm]   = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState(false);

  const handleAddClass = async () => {
    if (!classForm.grade || !classForm.section) { toast({ title: "Grade and section required", variant: "error" }); return; }
    try {
      await createClass.mutateAsync({ grade: Number(classForm.grade), section: classForm.section, name: classForm.grade + classForm.section } as Parameters<typeof createClass.mutateAsync>[0]);
      toast({ title: `Grade ${classForm.grade}${classForm.section} added`, variant: "success" });
      setShowClassForm(false);
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to add class. It may already exist."), variant: "error" });
    }
  };

  const handleAddSubject = async () => {
    if (!subjectForm.name || !subjectForm.code) { toast({ title: "Name and code required", variant: "error" }); return; }
    try {
      await createSubject.mutateAsync(subjectForm);
      toast({ title: `"${subjectForm.name}" added`, variant: "success" });
      setSubjectForm({ name: "", code: "" });
      setShowSubjectForm(false);
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to add subject. Code may already exist."), variant: "error" });
    }
  };

  const handleDeleteSubject = async (id: number, name: string) => {
    if (!confirm(`Remove subject "${name}"?`)) return;
    try { await deleteSubject.mutateAsync(id); toast({ title: `"${name}" removed`, variant: "success" }); }
    catch (err) { toast({ title: getApiErrorMessage(err, "Failed to remove subject"), variant: "error" }); }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Classes &amp; Subjects</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">Manage academic structure for the current year</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowClassForm(true)} className="btn-outline flex items-center gap-2">
              <Plus size={15} /> Add Class
            </button>
            <button onClick={() => setShowSubjectForm(true)} className="btn-gold flex items-center gap-2">
              <Plus size={15} /> Add Subject
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Classes */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <h3 className="text-sm font-semibold text-navy">Classes</h3>
                <p className="text-xs text-[#5A6A8A] mt-0.5">{classes?.count ?? 0} configured</p>
              </div>
            </div>

            {showClassForm && (
              <div className="px-5 py-4 bg-navy-pale border-b border-[var(--border)]">
                <div className="flex gap-3 items-end">
                  <div>
                    <label className="form-label">Grade</label>
                    <select value={classForm.grade} onChange={(e) => setClassForm(f => ({ ...f, grade: e.target.value }))} className="form-input w-24 text-sm">
                      {[7,8,9,10,11,12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Section</label>
                    <select value={classForm.section} onChange={(e) => setClassForm(f => ({ ...f, section: e.target.value }))} className="form-input w-20 text-sm">
                      {["A","B","C","D"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <button onClick={handleAddClass} disabled={createClass.isPending} className="btn-gold text-xs px-3 py-2 disabled:opacity-60">
                    {createClass.isPending ? "Adding…" : "Add"}
                  </button>
                  <button onClick={() => setShowClassForm(false)} className="btn-ghost text-xs px-3 py-2">Cancel</button>
                </div>
              </div>
            )}

            {classesError ? (
              <QueryError resource="classes" onRetry={refetchClasses} />
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[600px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Class", "Students", "Class Teacher"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classes?.results?.sort((a, b) => b.grade - a.grade || a.section.localeCompare(b.section)).map((cls) => (
                    <tr key={cls.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                      <td className="px-4 py-3 font-medium text-navy">Grade {cls.name}</td>
                      <td className="px-4 py-3 text-[#5A6A8A]">{cls.student_count}</td>
                      <td className="px-4 py-3 text-[#5A6A8A] text-xs">{cls.class_teacher_name ?? "—"}</td>
                    </tr>
                  ))}
                  {!classes?.results?.length && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-[#8A9ABB] text-sm">No classes configured</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Subjects */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-navy">Subjects</h3>
                <p className="text-xs text-[#5A6A8A] mt-0.5">{subjects?.count ?? 0} configured · fully configurable</p>
              </div>
              <span className="badge-ok text-[10px]">DB-Driven</span>
            </div>

            {showSubjectForm && (
              <div className="bg-navy-pale rounded-lg p-4 mb-4 border border-[var(--border)]">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="form-label">Subject Name *</label>
                    <input value={subjectForm.name} onChange={(e) => setSubjectForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Environmental Science" className="form-input text-sm" />
                  </div>
                  <div>
                    <label className="form-label">Code *</label>
                    <input value={subjectForm.code} onChange={(e) => setSubjectForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. ENV" className="form-input text-sm font-mono" maxLength={10} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddSubject} disabled={createSubject.isPending} className="btn-gold text-xs px-3 py-2 disabled:opacity-60">
                    {createSubject.isPending ? "Adding…" : "✓ Add Subject"}
                  </button>
                  <button onClick={() => setShowSubjectForm(false)} className="btn-ghost text-xs px-3 py-2">Cancel</button>
                </div>
              </div>
            )}

            {subjectsError ? (
              <QueryError resource="subjects" onRetry={refetchSubjects} />
            ) : (
            <div className="flex flex-wrap gap-2">
              {subjects?.results?.map((sub) => (
                <div key={sub.id} className="flex items-center gap-1.5 bg-navy-pale border border-navy/15 rounded-full px-3 py-1.5">
                  <span className="text-xs font-medium text-navy">{sub.name}</span>
                  <span className="text-[10px] text-[#8A9ABB] font-mono">({sub.code})</span>
                  <button
                    onClick={() => handleDeleteSubject(sub.id, sub.name)}
                    className="text-[#8A9ABB] hover:text-[var(--err)] transition-colors ml-1 leading-none"
                    title="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {!subjects?.results?.length && (
                <p className="text-sm text-[#8A9ABB]">No subjects configured yet</p>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
