"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Mail, Phone } from "lucide-react";
import { useGuardians, useCreateGuardian, useStudents } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import { api } from "@/lib/api/client";
import type { Guardian } from "@/types";

function GuardianModal({
  open, guardian, onClose,
}: { open: boolean; guardian: Guardian | null; onClose: () => void }) {
  const { toast } = useToast();
  const { data: students } = useStudents({ page_size: 500 });
  const createGuardian = useCreateGuardian();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: guardian?.full_name ?? "",
    phone_number: guardian?.phone_number ?? "",
    email: guardian?.email ?? "",
    address: guardian?.address ?? "",
    occupation: guardian?.occupation ?? "",
  });
  const [linkedStudents, setLinked] = useState<number[]>([]);

  const toggleStudent = (id: number) => {
    setLinked((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.phone_number) {
      toast({ title: "Name and phone required", variant: "error" }); return;
    }
    setSaving(true);
    try {
      if (guardian) {
        await api.patch(`/api/guardians/${guardian.id}/`, form);
        toast({ title: `${form.full_name} updated`, variant: "success" });
      } else {
        await createGuardian.mutateAsync(form);
        toast({ title: `${form.full_name} added`, variant: "success" });
      }
      onClose();
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save guardian"), variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-card shadow-lg w-full max-w-xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-navy font-serif">{guardian ? "Edit Guardian" : "Add Guardian"}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--surface)] text-[#5A6A8A] transition-colors text-lg leading-none">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name *</label>
              <input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} className="form-input" placeholder="e.g. Mr. James Kollie" />
            </div>
            <div>
              <label className="form-label">Phone *</label>
              <input value={form.phone_number} onChange={(e) => setForm(f => ({ ...f, phone_number: e.target.value }))} className="form-input" placeholder="+231 886 XXX XXX" />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="form-input" />
            </div>
            <div>
              <label className="form-label">Occupation</label>
              <input value={form.occupation} onChange={(e) => setForm(f => ({ ...f, occupation: e.target.value }))} className="form-input" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Address</label>
              <input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} className="form-input" />
            </div>
          </div>
          <div>
            <label className="form-label">Linked Students</label>
            <div className="flex flex-wrap gap-2 mt-1 max-h-32 overflow-y-auto">
              {students?.results?.map((s) => {
                const linked = linkedStudents.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleStudent(s.id)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${linked ? "bg-navy text-white border-navy" : "bg-white text-[#5A6A8A] border-[var(--border-strong)] hover:border-navy"}`}>
                    {s.first_name} {s.last_name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button onClick={onClose} className="btn-outline">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-gold disabled:opacity-60">
              {saving ? "Saving…" : `✓ ${guardian ? "Update" : "Add"} Guardian`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GuardiansPage() {
  const [modalOpen, setModalOpen]   = useState(false);
  const [editGuardian, setEdit]     = useState<Guardian | null>(null);
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useGuardians({ page_size: 100 });
  const guardians = data?.results ?? [];

  const handleDelete = async (g: Guardian) => {
    if (!confirm(`Delete ${g.full_name}?`)) return;
    try {
      await api.delete(`/api/guardians/${g.id}/`);
      toast({ title: "Guardian removed", variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to delete guardian"), variant: "error" });
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Guardians Directory</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">{data?.count ?? 0} guardians registered</p>
          </div>
          <button onClick={() => { setEdit(null); setModalOpen(true); }} className="btn-gold flex items-center gap-2">
            <Plus size={15} /> Add Guardian
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-[#5A6A8A] text-sm">Loading guardians…</div>
          ) : isError ? (
            <QueryError resource="guardians" onRetry={refetch} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Guardian", "Contact", "Address", "Occupation", "Students", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guardians.map((g) => {
                    const ini = g.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <tr key={g.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-navy-pale flex items-center justify-center text-navy font-semibold text-xs flex-shrink-0">{ini}</div>
                            <div>
                              <p className="font-medium text-navy">{g.full_name}</p>
                              <p className="text-xs text-[#5A6A8A]">Guardian</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-[#5A6A8A]"><Phone size={11} />{g.phone_number || "—"}</div>
                          <div className="flex items-center gap-1.5 text-xs text-[#5A6A8A] mt-0.5"><Mail size={11} />{g.email || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#5A6A8A]">{g.address || "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#5A6A8A]">{g.occupation || "—"}</td>
                        <td className="px-4 py-3"><span className="text-xs text-[#5A6A8A]">—</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => { setEdit(g); setModalOpen(true); }} className="p-1.5 rounded hover:bg-[var(--surface2)] text-[#5A6A8A] hover:text-navy transition-colors"><Pencil size={14} /></button>
                            <button onClick={() => handleDelete(g)} className="p-1.5 rounded hover:bg-[var(--err-bg)] text-[#5A6A8A] hover:text-[var(--err)] transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!guardians.length && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-[#8A9ABB]">No guardians found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <GuardianModal open={modalOpen} guardian={editGuardian} onClose={() => setModalOpen(false)} />
    </>
  );
}
