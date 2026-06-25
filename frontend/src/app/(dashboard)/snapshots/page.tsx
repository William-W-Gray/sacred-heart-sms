"use client";
import { useState } from "react";
import { Archive, Download, Trash2, Plus, Eye, CheckCircle2, XCircle } from "lucide-react";
import { useSnapshots, useDeleteSnapshot } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import { SnapshotModal } from "@/components/forms/SnapshotModal";
import { SnapshotDetailModal } from "@/components/forms/SnapshotDetailModal";
import type { Snapshot } from "@/lib/api/services";

const TYPE_LABELS: Record<string, string> = {
  manual: "Manual", system: "System", pre_update: "Pre-Update", pre_delete: "Pre-Delete",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SnapshotsPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSnapshot, setDetailSnapshot] = useState<Snapshot | null>(null);

  const { data, isLoading, isError, refetch } = useSnapshots();
  const deleteSnapshot = useDeleteSnapshot();

  const snapshots = data?.results ?? [];

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete snapshot "${name}"? It will move to Trash and can be restored within 7 days, or permanently deleted from there.`)) return;
    try {
      await deleteSnapshot.mutateAsync(id);
      toast({ title: "Snapshot moved to Trash", variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to delete snapshot"), variant: "error" });
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Snapshots</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              On-demand exports of the selected school data, downloadable any time.
            </p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="btn-gold flex items-center gap-2 self-start sm:self-auto">
            <Plus size={15} /> Create Snapshot
          </button>
        </div>
      </div>

      <div className="page-content">
        {isLoading ? (
          <div className="card flex items-center justify-center h-48 text-sm text-[var(--muted)]">
            <span className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin mr-2" />
            Loading snapshots…
          </div>
        ) : isError ? (
          <div className="card">
            <QueryError resource="snapshots" onRetry={refetch} />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="card flex flex-col items-center justify-center h-48 text-[var(--muted)]">
            <Archive size={28} className="mb-2 opacity-40" />
            <p className="text-sm">No snapshots yet</p>
            <button onClick={() => setCreateOpen(true)} className="btn-gold mt-4 flex items-center gap-2">
              <Plus size={14} /> Create your first snapshot
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[800px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Name", "Type", "Status", "Records", "Size", "Created By", "Created At", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                      <td className="px-4 py-3 font-medium text-navy max-w-[220px] truncate" title={s.name}>{s.name}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">{TYPE_LABELS[s.snapshot_type] ?? s.snapshot_type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.status === "completed" ? "text-[var(--ok)]" : "text-[var(--err)]"}`}>
                          {s.status === "completed" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {s.status === "completed" ? "Completed" : "Failed"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] font-mono">{s.record_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] font-mono">{formatBytes(s.size_bytes)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">{s.created_by_email ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] font-mono">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDetailSnapshot(s)}
                            className="p-1.5 rounded hover:bg-[var(--surface2)] text-[#5A6A8A] hover:text-navy transition-colors"
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                          {s.file && (
                            <a
                              href={s.file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-navy-pale text-navy transition-colors"
                              title="Download"
                            >
                              <Download size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            disabled={deleteSnapshot.isPending}
                            className="p-1.5 rounded hover:bg-[var(--err-bg)] text-[var(--muted)] hover:text-[var(--err)] transition-colors disabled:opacity-50"
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
          </div>
        )}
      </div>

      <SnapshotModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <SnapshotDetailModal snapshot={detailSnapshot} onClose={() => setDetailSnapshot(null)} />
    </>
  );
}
