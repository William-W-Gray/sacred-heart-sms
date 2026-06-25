"use client";
import { useState } from "react";
import { RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { useTrash, useRestoreFromTrash, usePurgeFromTrash } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";

export default function TrashPage() {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState("");

  const { data, isLoading, isError, refetch } = useTrash(typeFilter ? { type: typeFilter } : undefined);
  const restore = useRestoreFromTrash();
  const purge   = usePurgeFromTrash();

  const items = data?.results ?? [];
  const types = Array.from(new Map(items.map((i) => [i.type, i.type_label])).entries());

  const handleRestore = async (type: string, id: number, label: string) => {
    try {
      await restore.mutateAsync({ type, id });
      toast({ title: `${label} restored`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to restore"), variant: "error" });
    }
  };

  const handlePurge = async (type: string, id: number, label: string) => {
    if (!confirm(`Permanently delete ${label}? This cannot be undone — it won't wait for the 7-day window.`)) return;
    try {
      await purge.mutateAsync({ type, id });
      toast({ title: `${label} permanently deleted`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to delete"), variant: "error" });
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Trash</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              Deleted records are recoverable for {data?.retention_days ?? 7} days, then permanently removed.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <select
            className="form-input w-full sm:w-56 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {types.map(([slug, label]) => (
              <option key={slug} value={slug}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="page-content">
        {isLoading ? (
          <div className="card flex items-center justify-center h-48 text-sm text-[var(--muted)]">
            <span className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin mr-2" />
            Loading trash…
          </div>
        ) : isError ? (
          <div className="card">
            <QueryError resource="trash" onRetry={refetch} />
          </div>
        ) : items.length === 0 ? (
          <div className="card flex flex-col items-center justify-center h-48 text-[var(--muted)]">
            <Trash2 size={28} className="mb-2 opacity-40" />
            <p className="text-sm">Trash is empty</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Type", "Record", "Deleted By", "Deleted At", "Expires", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.type}-${item.id}`} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase bg-navy-pale text-navy border-navy/20">
                          {item.type_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-navy">{item.label}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">{item.deleted_by ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] font-mono">
                        {new Date(item.deleted_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${item.days_remaining <= 1 ? "text-[var(--err)]" : "text-[var(--muted)]"}`}>
                          {item.days_remaining <= 1 && <AlertTriangle size={12} />}
                          {item.days_remaining === 0 ? "today" : `${item.days_remaining}d left`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRestore(item.type, item.id, item.label)}
                            disabled={restore.isPending}
                            className="p-1.5 rounded hover:bg-[var(--ok-bg)] text-[var(--ok)] transition-colors disabled:opacity-50"
                            title="Restore"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handlePurge(item.type, item.id, item.label)}
                            disabled={purge.isPending}
                            className="p-1.5 rounded hover:bg-[var(--err-bg)] text-[var(--muted)] hover:text-[var(--err)] transition-colors disabled:opacity-50"
                            title="Delete permanently"
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
          </div>
        )}
      </div>
    </>
  );
}
