"use client";
import { useState } from "react";
import { Archive, Download, Trash2, Plus } from "lucide-react";
import { useSnapshots, useCreateSnapshot, useDeleteSnapshot } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SnapshotsPage() {
  const { toast } = useToast();
  const [label, setLabel] = useState("");

  const { data, isLoading, isError, refetch } = useSnapshots();
  const createSnapshot = useCreateSnapshot();
  const deleteSnapshot = useDeleteSnapshot();

  const snapshots = data?.results ?? [];

  const handleCreate = async () => {
    try {
      await createSnapshot.mutateAsync(label.trim() || undefined);
      setLabel("");
      toast({ title: "Snapshot created", variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to create snapshot"), variant: "error" });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete snapshot "${name}"? This cannot be undone.`)) return;
    try {
      await deleteSnapshot.mutateAsync(id);
      toast({ title: "Snapshot deleted", variant: "success" });
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
              On-demand exports of students, teachers, marks, attendance, and finance data.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Optional label, e.g. Before semester 2 close-out"
            className="form-input w-full sm:w-80 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={createSnapshot.isPending}
            className="btn-gold flex items-center gap-2 disabled:opacity-60 justify-center"
          >
            <Plus size={15} />
            {createSnapshot.isPending ? "Creating…" : "Create Snapshot"}
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
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Label", "Records", "Size", "Created By", "Created At", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                      <td className="px-4 py-3 font-medium text-navy">{s.label || `Snapshot #${s.id}`}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] font-mono">{s.record_count ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] font-mono">{formatBytes(s.size_bytes)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">{s.created_by_email ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] font-mono">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <a
                            href={s.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-navy-pale text-navy transition-colors"
                            title="Download"
                          >
                            <Download size={14} />
                          </a>
                          <button
                            onClick={() => handleDelete(s.id, s.label || `Snapshot #${s.id}`)}
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
    </>
  );
}
