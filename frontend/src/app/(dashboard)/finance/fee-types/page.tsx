"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Tag, ArrowLeft, Loader2, Power } from "lucide-react";
import {
  useFeeTypes, useCreateFeeType, useUpdateFeeType, useDeleteFeeType,
  useAcademicYears, useSemesters, useClasses,
} from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { FeeType, FeeAppliesTo } from "@/types";

const APPLIES_TO: { value: FeeAppliesTo; label: string }[] = [
  { value: "all", label: "All Students" },
  { value: "class", label: "Specific Class" },
  { value: "student", label: "Individual Student" },
];

const fmt = (n: number | string) =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FeeTypesPage() {
  const { data, isLoading, isError, refetch } = useFeeTypes({ page_size: 200 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeeType | null>(null);
  const updateFeeType = useUpdateFeeType();
  const deleteFeeType = useDeleteFeeType();
  const { toast } = useToast();

  const feeTypes = data?.results ?? [];

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (ft: FeeType) => { setEditing(ft); setModalOpen(true); };

  const toggleActive = async (ft: FeeType) => {
    try {
      await updateFeeType.mutateAsync({ id: ft.id, is_active: !ft.is_active });
      toast({ title: `${ft.name} ${ft.is_active ? "deactivated" : "activated"}.`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Could not update fee type."), variant: "error" });
    }
  };

  const handleDelete = async (ft: FeeType) => {
    if (!confirm(`Move "${ft.name}" to Trash? Existing invoices already raised against it are not affected.`)) return;
    try {
      await deleteFeeType.mutateAsync(ft.id);
      toast({ title: "Fee type moved to Trash.", variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Could not delete fee type."), variant: "error" });
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href="/finance" className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-navy mb-1">
            <ArrowLeft size={13} /> Back to Finance
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold text-navy">
            <Tag size={18} className="text-[var(--gold-dim)]" /> Fee Types
          </h1>
          <p className="text-sm text-[var(--muted)]">Manage the catalogue of fees the school charges.</p>
        </div>
        <button className="btn-gold" onClick={openCreate}>
          <Plus size={15} /> New Fee Type
        </button>
      </div>

      {isError ? (
        <QueryError resource="fee types" onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 w-full rounded-lg" />)}
        </div>
      ) : feeTypes.length === 0 ? (
        <div className="card p-10 text-center">
          <Tag size={32} className="mx-auto text-[var(--muted)] mb-3" />
          <p className="text-sm font-medium text-navy">No fee types yet</p>
          <p className="text-xs text-[var(--muted)] mb-4">Create your first fee type to start billing students.</p>
          <button className="btn-gold mx-auto" onClick={openCreate}><Plus size={15} /> New Fee Type</button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Default Amount</th>
                <th className="px-4 py-3 font-semibold">Applies To</th>
                <th className="px-4 py-3 font-semibold">Year / Semester</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {feeTypes.map((ft) => (
                <tr key={ft.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-navy">{ft.name}</div>
                    {ft.description && <div className="text-xs text-[var(--muted)] line-clamp-1 max-w-xs">{ft.description}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-navy">{fmt(ft.default_amount)}</td>
                  <td className="px-4 py-3 text-[#5A6A8A]">
                    {ft.applies_to_display || ft.applies_to}
                    {ft.applies_to === "class" && ft.default_class_name && <span className="text-xs text-[var(--muted)]"> · {ft.default_class_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5A6A8A]">
                    {ft.academic_year_name || "—"}{ft.semester_name ? ` · ${ft.semester_name}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${ft.is_active ? "bg-[#1B6B3A]/10 text-[#1B6B3A]" : "bg-[var(--border)] text-[var(--muted)]"}`}>
                      {ft.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button title={ft.is_active ? "Deactivate" : "Activate"} onClick={() => toggleActive(ft)}
                        className="p-1.5 rounded hover:bg-white text-[#5A6A8A] hover:text-navy">
                        <Power size={15} />
                      </button>
                      <button title="Edit" onClick={() => openEdit(ft)}
                        className="p-1.5 rounded hover:bg-white text-[#5A6A8A] hover:text-navy">
                        <Pencil size={15} />
                      </button>
                      <button title="Delete" onClick={() => handleDelete(ft)}
                        className="p-1.5 rounded hover:bg-white text-[#5A6A8A] hover:text-crimson-light">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <FeeTypeModal feeType={editing} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function FeeTypeModal({ feeType, onClose }: { feeType: FeeType | null; onClose: () => void }) {
  const { toast } = useToast();
  const createFeeType = useCreateFeeType();
  const updateFeeType = useUpdateFeeType();
  const { data: years } = useAcademicYears();
  const { data: semesters } = useSemesters();
  const { data: classes } = useClasses({ page_size: 200 });

  const [form, setForm] = useState({
    name: feeType?.name ?? "",
    description: feeType?.description ?? "",
    default_amount: feeType?.default_amount != null ? String(feeType.default_amount) : "",
    applies_to: (feeType?.applies_to ?? "all") as FeeAppliesTo,
    academic_year: feeType?.academic_year != null ? String(feeType.academic_year) : "",
    semester: feeType?.semester != null ? String(feeType.semester) : "",
    default_class: feeType?.default_class != null ? String(feeType.default_class) : "",
    is_active: feeType?.is_active ?? true,
  });

  const yearList = years?.results ?? [];
  const semesterList = semesters?.results ?? [];

  // Default the academic year to the current one when creating.
  useEffect(() => {
    if (!feeType && !form.academic_year && yearList.length) {
      const current = yearList.find((y) => y.is_current) ?? yearList[0];
      if (current) setForm((f) => ({ ...f, academic_year: String(current.id) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const semestersForYear = semesterList.filter(
    (s) => !form.academic_year || s.academic_year === Number(form.academic_year),
  );
  const classesForYear = (classes?.results ?? []).filter(
    (c) => !form.academic_year || c.academic_year === Number(form.academic_year),
  );

  const saving = createFeeType.isPending || updateFeeType.isPending;

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Fee type name is required.", variant: "error" }); return; }
    if (form.default_amount === "" || Number(form.default_amount) < 0) {
      toast({ title: "Enter a valid default amount.", variant: "error" }); return;
    }
    const payload: Partial<FeeType> = {
      name: form.name.trim(),
      description: form.description.trim(),
      default_amount: Number(form.default_amount),
      applies_to: form.applies_to,
      academic_year: form.academic_year ? Number(form.academic_year) : null,
      semester: form.semester ? Number(form.semester) : null,
      default_class: form.applies_to === "class" && form.default_class ? Number(form.default_class) : null,
      is_active: form.is_active,
    };
    try {
      if (feeType) {
        await updateFeeType.mutateAsync({ id: feeType.id, ...payload });
        toast({ title: "Fee type updated successfully.", variant: "success" });
      } else {
        await createFeeType.mutateAsync(payload);
        toast({ title: "Fee type created successfully.", variant: "success" });
      }
      onClose();
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Could not save fee type."), variant: "error" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-navy font-serif mb-5">{feeType ? "Edit Fee Type" : "New Fee Type"}</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">Name <span className="text-crimson-light">*</span></label>
            <input className="form-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Laboratory Fee" />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Default Amount ($) <span className="text-crimson-light">*</span></label>
              <input type="number" min="0" step="0.01" className="form-input" value={form.default_amount} onChange={(e) => set("default_amount", e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Applies To</label>
              <select className="form-input" value={form.applies_to} onChange={(e) => set("applies_to", e.target.value)}>
                {APPLIES_TO.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>
          {form.applies_to === "class" && (
            <div>
              <label className="form-label">Default Class</label>
              <select className="form-input" value={form.default_class} onChange={(e) => set("default_class", e.target.value)}>
                <option value="">Select class…</option>
                {classesForYear.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Academic Year</label>
              <select className="form-input" value={form.academic_year} onChange={(e) => { set("academic_year", e.target.value); set("semester", ""); }}>
                <option value="">— None —</option>
                {yearList.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Semester</label>
              <select className="form-input" value={form.semester} onChange={(e) => set("semester", e.target.value)}>
                <option value="">— Any —</option>
                {semestersForYear.map((s) => <option key={s.id} value={s.id}>Semester {s.number}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="accent-[var(--gold)]" />
            <span className="text-sm text-navy">Active (available for billing)</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {feeType ? "Save changes" : "Create fee type"}
          </button>
        </div>
      </div>
    </div>
  );
}
