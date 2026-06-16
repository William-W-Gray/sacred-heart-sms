"use client";
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Mail, Phone, Search, Star } from "lucide-react";
import {
  useGuardians, useCreateGuardian, useUpdateGuardian,
  useDeleteGuardian, useSetGuardianStudents, useStudents,
} from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { Guardian } from "@/types";

const RELATIONSHIPS = [
  { value: "father",      label: "Father" },
  { value: "mother",      label: "Mother" },
  { value: "uncle",       label: "Uncle" },
  { value: "aunt",        label: "Aunt" },
  { value: "grandparent", label: "Grandparent" },
  { value: "sibling",     label: "Sibling" },
  { value: "other",       label: "Other" },
];

type StudentLink = { student: number; relationship: string; is_primary: boolean };

function GuardianModal({
  open, guardian, onClose,
}: { open: boolean; guardian: Guardian | null; onClose: () => void }) {
  const { toast } = useToast();
  const { data: studentsData } = useStudents({ page_size: 500 });
  const createGuardian    = useCreateGuardian();
  const updateGuardian    = useUpdateGuardian();
  const setGuardianStudents = useSetGuardianStudents();
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    address: "",
    occupation: "",
  });
  const [linked, setLinked] = useState<StudentLink[]>([]);

  // Reset form whenever the modal opens (for a new or existing guardian)
  useEffect(() => {
    if (open) {
      setForm({
        full_name:    guardian?.full_name    ?? "",
        phone_number: guardian?.phone_number ?? "",
        email:        guardian?.email        ?? "",
        address:      guardian?.address      ?? "",
        occupation:   guardian?.occupation   ?? "",
      });
      setLinked(
        guardian?.linked_students?.map((ls) => ({
          student:      ls.student_id,
          relationship: ls.relationship,
          is_primary:   ls.is_primary,
        })) ?? [],
      );
      setStudentSearch("");
    }
  }, [open, guardian]);

  const toggleStudent = (id: number) => {
    setLinked((prev) => {
      const exists = prev.find((l) => l.student === id);
      if (exists) {
        const rest = prev.filter((l) => l.student !== id);
        // If we removed the primary, promote the next one
        if (exists.is_primary && rest.length > 0) {
          return rest.map((l, i) => ({ ...l, is_primary: i === 0 }));
        }
        return rest;
      }
      return [...prev, { student: id, relationship: "other", is_primary: prev.length === 0 }];
    });
  };

  const updateLink = (id: number, patch: Partial<StudentLink>) => {
    setLinked((prev) =>
      prev.map((l) => {
        if (l.student !== id) {
          // Clear primary on others when promoting a new one
          return patch.is_primary ? { ...l, is_primary: false } : l;
        }
        return { ...l, ...patch };
      }),
    );
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.phone_number.trim()) {
      toast({ title: "Name and phone are required", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      let guardianId: number;
      if (guardian) {
        await updateGuardian.mutateAsync({ id: guardian.id, ...form });
        guardianId = guardian.id;
      } else {
        const created = await createGuardian.mutateAsync(form);
        guardianId = created.id;
      }
      // Sync student links — always call even if empty (clears existing)
      try {
        await setGuardianStudents.mutateAsync({ guardianId, links: linked });
      } catch {
        toast({
          title: "Guardian saved — but student links failed. Edit the guardian to retry.",
          variant: "error",
        });
        onClose();
        return;
      }
      toast({
        title: `${form.full_name} ${guardian ? "updated" : "added"}${linked.length ? ` · ${linked.length} student(s) linked` : ""}`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save guardian"), variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const allStudents = studentsData?.results ?? [];
  const filtered = studentSearch
    ? allStudents.filter((s) =>
        `${s.first_name} ${s.last_name} ${s.student_id}`
          .toLowerCase()
          .includes(studentSearch.toLowerCase()),
      )
    : allStudents;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10 rounded-t-[20px]">
          <h2 className="text-xl font-semibold text-navy font-serif">
            {guardian ? "Edit Guardian" : "Add Guardian"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--surface)] text-[#5A6A8A] transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Guardian info */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
              Guardian Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. Mr. James Kollie"
                />
              </div>
              <div>
                <label className="form-label">Phone *</label>
                <input
                  value={form.phone_number}
                  onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                  className="form-input"
                  placeholder="+231 886 XXX XXX"
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Occupation</label>
                <input
                  value={form.occupation}
                  onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Student linking */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)] mb-1">
              Linked Students
              <span className="font-normal normal-case ml-1 text-navy">
                ({linked.length} selected)
              </span>
            </p>
            <p className="text-xs text-[var(--muted)] mb-3">
              Click a student to link them. Set the relationship and mark one as primary contact.
            </p>

            {/* Student search */}
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name or ID…"
                className="form-input pl-8 text-sm"
              />
            </div>

            {/* Student chip picker */}
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
              {filtered.length === 0 && (
                <p className="text-xs text-[var(--muted)] py-1 w-full text-center">
                  {allStudents.length === 0 ? "Loading students…" : "No students match your search"}
                </p>
              )}
              {filtered.map((s) => {
                const isLinked = linked.some((l) => l.student === s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStudent(s.id)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                      isLinked
                        ? "bg-navy text-white border-navy shadow-sm"
                        : "bg-white text-[#5A6A8A] border-[var(--border-strong)] hover:border-navy hover:text-navy"
                    }`}
                  >
                    {s.first_name} {s.last_name}
                    {s.class_name && (
                      <span className="opacity-60 ml-1">({s.class_name})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected students — relationship + primary controls */}
            {linked.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-[var(--muted)] font-semibold uppercase tracking-wider">
                  Set relationship
                </p>
                {linked.map((link) => {
                  const student = allStudents.find((s) => s.id === link.student);
                  if (!student) return null;
                  const initials = `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase();
                  return (
                    <div
                      key={link.student}
                      className="flex items-center gap-2 p-2.5 bg-[var(--navy-pale)] rounded-xl"
                    >
                      <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-navy truncate">
                          {student.first_name} {student.last_name}
                        </p>
                        {student.class_name && (
                          <p className="text-[10px] text-[var(--muted)]">{student.class_name}</p>
                        )}
                      </div>
                      <select
                        value={link.relationship}
                        onChange={(e) => updateLink(link.student, { relationship: e.target.value })}
                        className="text-xs border border-[var(--border-strong)] bg-white rounded-lg px-2 py-1 text-navy flex-shrink-0"
                      >
                        {RELATIONSHIPS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        title={link.is_primary ? "Primary contact" : "Set as primary contact"}
                        onClick={() => updateLink(link.student, { is_primary: true })}
                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all flex-shrink-0 ${
                          link.is_primary
                            ? "bg-[var(--gold)] text-navy-deep border-[var(--gold)] font-bold"
                            : "bg-white text-[var(--muted)] border-[var(--border-strong)] hover:border-[var(--gold)] hover:text-[var(--gold-dim)]"
                        }`}
                      >
                        <Star size={10} className={link.is_primary ? "fill-navy-deep" : ""} />
                        Primary
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStudent(link.student)}
                        className="p-1 rounded text-[var(--muted)] hover:text-[var(--err)] hover:bg-[var(--err-bg)] transition-colors flex-shrink-0"
                        title="Remove link"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)] sticky bottom-0 bg-white rounded-b-[20px]">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-gold disabled:opacity-60">
            {saving ? "Saving…" : `✓ ${guardian ? "Update" : "Add"} Guardian`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GuardiansPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editGuardian, setEdit]   = useState<Guardian | null>(null);
  const { toast } = useToast();
  const deleteGuardian = useDeleteGuardian();

  const { data, isLoading, isError, refetch } = useGuardians({ page_size: 100 });
  const guardians = data?.results ?? [];

  const openAdd  = () => { setEdit(null); setModalOpen(true); };
  const openEdit = (g: Guardian) => { setEdit(g); setModalOpen(true); };

  const handleDelete = async (g: Guardian) => {
    if (!confirm(`Delete ${g.full_name}? This will also remove all student links.`)) return;
    try {
      await deleteGuardian.mutateAsync(g.id);
      toast({ title: `${g.full_name} removed`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to delete guardian"), variant: "error" });
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Guardians Directory</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">{data?.count ?? 0} guardians registered</p>
          </div>
          <button onClick={openAdd} className="btn-gold flex items-center gap-2">
            <Plus size={15} /> Add Guardian
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-[#5A6A8A] text-sm">
              Loading guardians…
            </div>
          ) : isError ? (
            <QueryError resource="guardians" onRetry={refetch} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Guardian", "Contact", "Address", "Occupation", "Students", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guardians.map((g) => {
                    const ini = g.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <tr
                        key={g.id}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-navy-pale flex items-center justify-center text-navy font-semibold text-xs flex-shrink-0">
                              {ini}
                            </div>
                            <div>
                              <p className="font-medium text-navy">{g.full_name}</p>
                              <p className="text-xs text-[#5A6A8A]">Guardian</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-[#5A6A8A]">
                            <Phone size={11} />{g.phone_number || "—"}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[#5A6A8A] mt-0.5">
                            <Mail size={11} />{g.email || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#5A6A8A]">{g.address || "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#5A6A8A]">{g.occupation || "—"}</td>
                        <td className="px-4 py-3">
                          {g.linked_students && g.linked_students.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {g.linked_students.slice(0, 2).map((ls) => (
                                <span
                                  key={ls.student_id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy-pale text-navy text-[10px] rounded-full font-medium"
                                >
                                  {ls.student_name.split(" ")[0]}
                                  {ls.is_primary && (
                                    <Star size={8} className="fill-[var(--gold)] text-[var(--gold)]" />
                                  )}
                                </span>
                              ))}
                              {g.linked_students.length > 2 && (
                                <span className="px-2 py-0.5 bg-[var(--surface2)] text-[#5A6A8A] text-[10px] rounded-full font-medium">
                                  +{g.linked_students.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#8A9ABB] italic">None linked</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit(g)}
                              className="p-1.5 rounded hover:bg-[var(--surface2)] text-[#5A6A8A] hover:text-navy transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(g)}
                              className="p-1.5 rounded hover:bg-[var(--err-bg)] text-[#5A6A8A] hover:text-[var(--err)] transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!guardians.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[#8A9ABB]">
                        No guardians found — click &ldquo;Add Guardian&rdquo; to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <GuardianModal
        open={modalOpen}
        guardian={editGuardian}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
