"use client";

import { AlertTriangle, Download, Receipt as ReceiptIcon } from "lucide-react";
import { useInvoices } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QueryError } from "@/components/shared/QueryError";
import { downloadReceipt } from "@/lib/utils/receipt";
import { financeTotals, money } from "@/lib/utils/finance";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { Invoice, Payment } from "@/types";

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", mobile_money: "Mobile Money", cheque: "Cheque",
};

/** Read-only finance view for one student — used by both the student's own
 * "My Finance" page and the guardian's per-child view. No mutation controls:
 * students/guardians can see fees, payments, balances and download receipts,
 * but never edit or record payments. */
export function StudentFinanceView({ studentId }: { studentId: number }) {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useInvoices(
    { student: studentId, page_size: 200 }, { enabled: !!studentId },
  );

  const invoices = data?.results ?? [];
  const totals = financeTotals(invoices);

  // Flatten payments across invoices for the payment-history table.
  const payments: (Payment & { _invoice: Invoice })[] = invoices
    .flatMap((inv) => (inv.payments ?? []).map((p) => ({ ...p, _invoice: inv })))
    .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1));

  const handleDownload = async (receiptId?: number | null, receiptNumber?: string | null) => {
    if (!receiptId) return;
    try {
      await downloadReceipt(receiptId, receiptNumber);
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Could not download receipt"), variant: "error" });
    }
  };

  if (isError) return <QueryError resource="finance records" onRetry={() => refetch()} />;
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overdue alert */}
      {totals.overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--err)]/30 bg-[var(--err-bg)] px-4 py-3 text-sm text-[var(--err)]">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>
            {totals.overdueCount} overdue invoice{totals.overdueCount === 1 ? "" : "s"} ·
            outstanding {money(totals.overdueAmount)}. Please settle as soon as possible.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Fees Assigned", value: money(totals.assigned), accent: "from-navy to-navy-light" },
          { label: "Total Paid", value: money(totals.paid), accent: "from-[#1B6B3A] to-[#2A9D5C]" },
          { label: "Outstanding Balance", value: money(totals.outstanding), accent: "from-crimson to-crimson-light" },
          { label: "Overdue", value: money(totals.overdueAmount), accent: "from-[#C8A84B] to-[#E8C96A]" },
        ].map((s) => (
          <div key={s.label} className="card relative overflow-hidden pt-0.5">
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${s.accent}`} />
            <div className="p-4">
              <p className="text-[10px] font-medium text-[#5A6A8A] uppercase tracking-wider mb-1.5">{s.label}</p>
              <p className="text-xl font-semibold text-navy font-mono">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-navy">Invoices</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--muted)]">No invoices yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {["Invoice #", "Fee", "Amount", "Paid", "Balance", "Due Date", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const balance = inv.balance ?? Number(inv.amount) - Number(inv.amount_paid ?? 0);
                  const overdue = inv.status === "overdue";
                  return (
                    <tr key={inv.id} className="border-t border-[var(--border)] hover:bg-[var(--surface)]">
                      <td className="px-4 py-2.5 font-mono text-xs text-[#5A6A8A]">{inv.invoice_number}</td>
                      <td className="px-4 py-2.5 capitalize">{inv.fee_display || inv.fee_label || inv.fee_type}</td>
                      <td className="px-4 py-2.5 font-mono">{money(inv.amount)}</td>
                      <td className="px-4 py-2.5 font-mono text-[var(--ok)]">{money(inv.amount_paid ?? 0)}</td>
                      <td className={`px-4 py-2.5 font-mono font-semibold ${balance > 0 ? "text-[var(--err)]" : "text-[var(--ok)]"}`}>{money(balance)}</td>
                      <td className={`px-4 py-2.5 text-xs ${overdue ? "text-[var(--err)] font-semibold" : "text-[#5A6A8A]"}`}>{inv.due_date}{overdue ? " ⚠" : ""}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={inv.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-navy">Payment History</h3>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--muted)]">No payments recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {["Date", "Invoice #", "Amount", "Method", "Reference", "Receipt"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--surface)]">
                    <td className="px-4 py-2.5 text-xs text-[#5A6A8A]">{p.payment_date}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#5A6A8A]">{p._invoice.invoice_number}</td>
                    <td className="px-4 py-2.5 font-mono text-[var(--ok)]">{money(p.amount)}</td>
                    <td className="px-4 py-2.5 text-xs">{METHOD_LABEL[p.method] || p.method}</td>
                    <td className="px-4 py-2.5 text-xs text-[#5A6A8A]">{p.reference_number || "—"}</td>
                    <td className="px-4 py-2.5">
                      {p.receipt_id ? (
                        <button
                          onClick={() => handleDownload(p.receipt_id, p.receipt_number)}
                          className="inline-flex items-center gap-1 text-xs text-navy hover:text-[var(--gold-dim)] font-medium"
                          title={`Download ${p.receipt_number}`}
                        >
                          <Download size={13} /> {p.receipt_number}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]"><ReceiptIcon size={13} /> —</span>
                      )}
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
