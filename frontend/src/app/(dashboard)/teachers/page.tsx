"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useTeachers, useDeleteTeacher, useSubjects } from "@/hooks/useApi";
import { useAuthStore } from "@/store/auth.store";
import { TeacherModal } from "@/components/forms/TeacherModal";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { Teacher } from "@/types";

export default function TeachersPage() {
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTeacher, setEdit]      = useState<Teacher | null>(null);
  const { toast } = useToast();
  const { role } = useAuthStore();
  // Teachers can view this directory (TeacherViewSet has no row-level
  // scoping), but only admin can create/edit/delete — TeacherViewSet.
  // get_permissions() is admin-only for those actions.
  const canEdit = role === "admin";

  const { data, isLoading, isError, refetch } = useTeachers({ page_size: 100 });
  const { data: subjects }  = useSubjects();
  const deleteTeacher       = useDeleteTeacher();

  const teachers = data?.results ?? [];

  const handleDelete = async (t: Teacher) => {
    if (!confirm(`Delete ${t.full_name}?`)) return;
    try { await deleteTeacher.mutateAsync(t.id); toast({ title: "Teacher removed", variant: "success" }); }
    catch (err) { toast({ title: getApiErrorMessage(err, "Failed to delete teacher"), variant: "error" }); }
  };

  const subjectName = (id: number) => subjects?.results?.find((s) => s.id === id)?.name ?? `#${id}`;

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Teaching Staff</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">{data?.count ?? 0} active teachers</p>
          </div>
          {canEdit && (
            <button onClick={() => { setEdit(null); setModalOpen(true); }} className="btn-gold flex items-center gap-2">
              <Plus size={15} /> Add Teacher
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-[#5A6A8A] text-sm">Loading teachers…</div>
          ) : isError ? (
            <QueryError resource="teachers" onRetry={refetch} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[640px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Teacher", "Email", "Phone", "Main Subject", "Teaching Subjects", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-navy-pale flex items-center justify-center text-navy font-semibold text-xs flex-shrink-0">
                            {t.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-navy">{t.full_name}</p>
                            <p className="text-xs text-[#5A6A8A]">{t.subject || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#5A6A8A] text-xs">{t.email}</td>
                      <td className="px-4 py-3 text-[#5A6A8A] text-xs">{t.phone_number || "—"}</td>
                      <td className="px-4 py-3 text-[#5A6A8A] text-xs">{t.subject || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(t.subjects ?? []).slice(0, 3).map((sid) => (
                            <span key={sid} className="badge-gold text-[10px]">{subjectName(sid)}</span>
                          ))}
                          {(t.subjects ?? []).length > 3 && (
                            <span className="text-xs text-[#5A6A8A]">+{(t.subjects ?? []).length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <div className="flex gap-1">
                            <button onClick={() => { setEdit(t); setModalOpen(true); }} className="p-1.5 rounded hover:bg-[var(--surface2)] text-[#5A6A8A] hover:text-navy transition-colors"><Pencil size={14} /></button>
                            <button onClick={() => handleDelete(t)} className="p-1.5 rounded hover:bg-[var(--err-bg)] text-[#5A6A8A] hover:text-[var(--err)] transition-colors"><Trash2 size={14} /></button>
                          </div>
                        ) : (
                          <span className="text-[#8A9ABB] text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!teachers.length && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-[#8A9ABB]">No teachers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <TeacherModal open={modalOpen} teacher={editTeacher} onClose={() => setModalOpen(false)} />
    </>
  );
}
