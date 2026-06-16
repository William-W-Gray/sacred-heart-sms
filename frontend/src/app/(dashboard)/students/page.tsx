"use client";
import { useState } from "react";
import { Plus, Search, Pencil, Trash2, FileText } from "lucide-react";
import Image from "next/image";
import { useStudents, useDeleteStudent, useClasses } from "@/hooks/useApi";
import { StudentModal } from "@/components/forms/StudentModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GradeCell } from "@/components/shared/GradeCell";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import Link from "next/link";
import type { Student } from "@/types";

export default function StudentsPage() {
  const [search, setSearch]         = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage]             = useState(1);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useStudents({
    search: search || undefined,
    current_class: classFilter || undefined,
    page,
    page_size: 20,
  });
  const { data: classes } = useClasses();
  const deleteStudent = useDeleteStudent();

  const students    = data?.results ?? [];
  const totalCount  = data?.count ?? 0;
  const totalPages  = Math.ceil(totalCount / 20);

  const handleDelete = async (student: Student) => {
    if (!confirm(`Delete ${student.full_name}? This cannot be undone.`)) return;
    try {
      await deleteStudent.mutateAsync(student.id);
      toast({ title: "Student removed", variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to delete student"), variant: "error" });
    }
  };

  const openAdd  = () => { setEditStudent(null); setModalOpen(true); };
  const openEdit = (s: Student) => { setEditStudent(s); setModalOpen(true); };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Student Registry</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">{totalCount} enrolled students · 2025/2026</p>
          </div>
          <button onClick={openAdd} className="btn-gold flex items-center gap-2">
            <Plus size={15} /> Enrol Student
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap mt-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A9ABB]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search students…"
              className="form-input pl-9 w-full sm:w-56 text-sm"
            />
          </div>
          <select
            value={classFilter}
            onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
            className="form-input w-full sm:w-40 text-sm"
          >
            <option value="">All Classes</option>
            {classes?.results?.map((c) => (
              <option key={c.id} value={c.id}>Grade {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="page-content">
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-[#5A6A8A] text-sm">
              Loading students…
            </div>
          ) : isError ? (
            <QueryError resource="students" onRetry={refetch} />
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#8A9ABB]">
              <div className="text-4xl mb-3">🎓</div>
              <p className="font-medium">No students found</p>
              <p className="text-sm mt-1">Adjust your search or enrol a new student</p>
              <button onClick={openAdd} className="btn-gold mt-4 flex items-center gap-2">
                <Plus size={14} /> Enrol Student
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[640px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Student", "ID", "Class", "Gender", "Guardian", "Status", "Year Avg", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {student.photo ? (
                            <Image src={student.photo} alt="" width={36} height={36} className="rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-navy-pale flex items-center justify-center text-navy font-semibold text-xs flex-shrink-0">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-navy">{student.full_name}</p>
                            <p className="text-xs text-[#5A6A8A]">DOB: {student.date_of_birth ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#5A6A8A]">{student.student_id}</td>
                      <td className="px-4 py-3">
                        {student.class_name ? (
                          <span className="badge-navy">{student.class_name}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#5A6A8A]">{student.gender === "F" ? "Female" : "Male"}</td>
                      <td className="px-4 py-3 text-[#5A6A8A]">
                        {student.guardians?.[0]?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={student.status} /></td>
                      <td className="px-4 py-3"><GradeCell value={null} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/report-cards?student=${student.id}`}
                            className="p-1.5 rounded hover:bg-[var(--surface2)] text-[#5A6A8A] hover:text-navy transition-colors"
                            title="Report Card"
                          >
                            <FileText size={14} />
                          </Link>
                          <button
                            onClick={() => openEdit(student)}
                            className="p-1.5 rounded hover:bg-[var(--surface2)] text-[#5A6A8A] hover:text-navy transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(student)}
                            className="p-1.5 rounded hover:bg-[var(--err-bg)] text-[#5A6A8A] hover:text-[var(--err)] transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-[var(--border)]">
              <p className="text-xs text-[#5A6A8A]">
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, totalCount)} of {totalCount} students
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="btn-outline px-3 py-1.5 text-xs disabled:opacity-40"
                >← Prev</button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="btn-outline px-3 py-1.5 text-xs disabled:opacity-40"
                >Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <StudentModal
        open={modalOpen}
        student={editStudent}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
