"use client";
import { useState } from "react";
import { Plus, Receipt, Trash2, CreditCard } from "lucide-react";
import { useInvoices, useCreateInvoice, useCreatePayment, useDeleteInvoice, useStudents } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { Invoice, PaymentMethod } from "@/types";

function InvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ student: "", type: "tuition", amount: "", dueDate: new Date().toISOString().split("T")[0], notes: "" });
  const { data: students } = useStudents({ page_size: 500 });
  const createInvoice = useCreateInvoice();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!form.student || !form.amount || !form.dueDate) { toast({ title: "Fill all required fields", variant: "error" }); return; }
    try {
      await createInvoice.mutateAsync({ student: Number(form.student), fee_type: form.type, amount: Number(form.amount), due_date: form.dueDate, notes: form.notes });
      toast({ title: "Invoice created", variant: "success" });
      onClose();
    } catch (err) { toast({ title: getApiErrorMessage(err, "Failed to create invoice"), variant: "error" }); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-lg mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-navy font-serif mb-5">Create Invoice</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">Student *</label>
            <select className="form-input" value={form.student} onChange={(e) => setForm(f => ({ ...f, student: e.target.value }))}>
              <option value="">Select student…</option>
              {students?.results?.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.student_id}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="form-label">Fee Type</label>
              <select className="form-input" value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}>
                {[
                { value: "tuition",  label: "Tuition Fee" },
                { value: "exam",     label: "Exam Fee" },
                { value: "activity", label: "Activity Fee" },
                { value: "uniform",  label: "Uniform Fee" },
                { value: "other",    label: "Other" },
              ].map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Amount (L$) *</label>
              <input type="number" className="form-input" placeholder="12000" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Due Date *</label>
              <input type="date" className="form-input" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <input className="form-input" placeholder="Optional…" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} disabled={createInvoice.isPending} className="btn-gold disabled:opacity-60">
            {createInvoice.isPending ? "Creating…" : "✓ Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const [form, setForm] = useState<{ amount: string; method: PaymentMethod; ref: string; date: string; notes: string }>({ amount: String(invoice.balance), method: "cash", ref: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const createPayment = useCreatePayment();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!form.amount || !form.method) { toast({ title: "Fill all required fields", variant: "error" }); return; }
    if (Number(form.amount) > invoice.balance + 0.01) { toast({ title: `Exceeds balance of L$${invoice.balance.toLocaleString()}`, variant: "error" }); return; }
    try {
      await createPayment.mutateAsync({ invoice: invoice.id, amount: Number(form.amount), method: form.method, reference_number: form.ref, payment_date: form.date, notes: form.notes });
      toast({ title: `L$${Number(form.amount).toLocaleString()} recorded`, variant: "success" });
      onClose();
    } catch (err) { toast({ title: getApiErrorMessage(err, "Failed to record payment"), variant: "error" }); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-lg mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-navy font-serif mb-2">Record Payment</h2>
        <div className="bg-navy-pale rounded-lg p-4 mb-5 text-sm space-y-2">
          <div className="flex justify-between"><span className="text-[#5A6A8A]">Invoice</span><span className="font-mono">{invoice.invoice_number}</span></div>
          <div className="flex justify-between"><span className="text-[#5A6A8A]">Amount</span><span className="font-mono">L${Number(invoice.amount).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-[#5A6A8A]">Already Paid</span><span className="font-mono text-[var(--ok)]">L${(invoice.amount_paid ?? 0).toLocaleString()}</span></div>
          <div className="flex justify-between font-semibold"><span className="text-[#5A6A8A]">Balance Due</span><span className="font-mono text-[var(--err)]">L${invoice.balance.toLocaleString()}</span></div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div><label className="form-label">Amount (L$) *</label><input type="number" className="form-input" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><label className="form-label">Method *</label>
              <select className="form-input" value={form.method} onChange={(e) => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}>
                {[
                  { value: "cash", label: "Cash" },
                  { value: "mobile_money", label: "Mobile Money" },
                  { value: "bank_transfer", label: "Bank Transfer" },
                  { value: "cheque", label: "Cheque" }
                ].map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div><label className="form-label">Reference No.</label><input className="form-input" placeholder="e.g. MTN-123456" value={form.ref} onChange={(e) => setForm(f => ({ ...f, ref: e.target.value }))} /></div>
            <div><label className="form-label">Payment Date</label><input type="date" className="form-input" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          </div>
          <div><label className="form-label">Notes</label><input className="form-input" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} disabled={createPayment.isPending} className="btn-gold disabled:opacity-60">
            {createPayment.isPending ? "Recording…" : "✓ Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [page, setPage]           = useState(1);
  const [invoiceOpen, setInvOpen] = useState(false);
  const [payInvoice, setPayInv]   = useState<Invoice | null>(null);
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useInvoices({ page, page_size: 20 });
  const deleteInvoice = useDeleteInvoice();

  const invoices   = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 20);

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid     = invoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const outstanding   = totalInvoiced - totalPaid;
  const collRate      = totalInvoiced > 0 ? Math.round(totalPaid / totalInvoiced * 100) : 0;

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this invoice and all its payments?")) return;
    try { await deleteInvoice.mutateAsync(id); toast({ title: "Invoice deleted", variant: "success" }); }
    catch (err) { toast({ title: getApiErrorMessage(err, "Failed to delete invoice"), variant: "error" }); }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Finance Management</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">Invoices, payments &amp; receipts</p>
          </div>
          <button onClick={() => setInvOpen(true)} className="btn-gold flex items-center gap-2"><Plus size={15} /> Create Invoice</button>
        </div>
      </div>

      <div className="page-content space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Collected",  value: `L$${totalPaid.toLocaleString()}`,        accent: "bg-gradient-to-r from-[#1B6B3A] to-[#2A9D5C]" },
            { label: "Outstanding",      value: `L$${outstanding.toLocaleString()}`,       accent: "bg-gradient-to-r from-crimson to-crimson-light" },
            { label: "Total Invoiced",   value: `L$${totalInvoiced.toLocaleString()}`,     accent: "bg-gradient-to-r from-navy to-navy-light" },
            { label: "Collection Rate",  value: `${collRate}%`,                            accent: "bg-gradient-to-r from-[#C8A84B] to-[#E8C96A]" },
          ].map((s) => (
            <div key={s.label} className="card relative overflow-hidden pt-0.5">
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.accent}`} />
              <div className="p-5">
                <p className="text-[11px] font-medium text-[#5A6A8A] uppercase tracking-wider mb-2">{s.label}</p>
                <p className="text-2xl font-semibold text-navy font-mono">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-[#5A6A8A] text-sm">Loading invoices…</div>
          ) : isError ? (
            <QueryError resource="invoices" onRetry={refetch} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Invoice #", "Student", "Type", "Amount", "Paid", "Balance", "Due Date", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const balance = inv.balance ?? (Number(inv.amount) - Number(inv.amount_paid ?? 0));
                    const overdue = inv.status === "overdue";
                    return (
                      <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[#5A6A8A]">{inv.invoice_number}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-navy">{inv.student_name ?? `Student #${inv.student}`}</p>
                          <p className="text-xs text-[#5A6A8A]">{inv.student_sid ?? ""}</p>
                        </td>
                        <td className="px-4 py-3 text-[#5A6A8A] text-xs">{inv.fee_type}</td>
                        <td className="px-4 py-3 font-mono text-sm">L${Number(inv.amount).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-sm text-[var(--ok)]">L${Number(inv.amount_paid ?? 0).toLocaleString()}</td>
                        <td className={`px-4 py-3 font-mono text-sm font-semibold ${balance > 0 ? "text-[var(--err)]" : "text-[var(--ok)]"}`}>L${balance.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-xs ${overdue ? "text-[var(--err)] font-semibold" : "text-[#5A6A8A]"}`}>{inv.due_date}{overdue ? " ⚠" : ""}</td>
                        <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {balance > 0 && (
                              <button onClick={() => setPayInv(inv)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-[var(--gold)] text-navy-deep hover:bg-[var(--gold-light)] transition-colors font-medium">
                                <CreditCard size={12} /> Pay
                              </button>
                            )}
                            <button className="p-1.5 rounded hover:bg-[var(--surface2)] text-[#5A6A8A] hover:text-navy transition-colors" title="Receipt">
                              <Receipt size={14} />
                            </button>
                            <button onClick={() => handleDelete(inv.id)} className="p-1.5 rounded hover:bg-[var(--err-bg)] text-[#5A6A8A] hover:text-[var(--err)] transition-colors" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-[var(--border)]">
              <p className="text-xs text-[#5A6A8A]">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, totalCount)} of {totalCount}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline px-3 py-1.5 text-xs disabled:opacity-40">← Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-outline px-3 py-1.5 text-xs disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <InvoiceModal open={invoiceOpen} onClose={() => setInvOpen(false)} />
      {payInvoice && <PaymentModal invoice={payInvoice} onClose={() => setPayInv(null)} />}
    </>
  );
}
