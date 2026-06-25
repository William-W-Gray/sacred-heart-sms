"use client";
import { X, Download, CheckCircle2, XCircle } from "lucide-react";
import type { Snapshot } from "@/lib/api/services";

const MODULE_LABELS: Record<string, string> = {
  users: "Users", students: "Students", staff: "Staff", classes: "Classes",
  subjects: "Subjects", attendance: "Attendance", grades: "Grades",
  finance: "Finance", settings: "Settings",
};

const TYPE_LABELS: Record<string, string> = {
  manual: "Manual", system: "System", pre_update: "Pre-Update", pre_delete: "Pre-Delete",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  snapshot: Snapshot | null;
  onClose: () => void;
}

export function SnapshotDetailModal({ snapshot, onClose }: Props) {
  if (!snapshot) return null;

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border)] last:border-0">
      <span className="text-xs font-medium text-[var(--muted)] flex-shrink-0">{label}</span>
      <span className="text-sm text-navy text-right break-words min-w-0">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-navy font-serif truncate pr-4">{snapshot.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--surface)] text-[#5A6A8A] transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-1">
          {row("Status", (
            <span className={`inline-flex items-center gap-1 font-medium ${snapshot.status === "completed" ? "text-[var(--ok)]" : "text-[var(--err)]"}`}>
              {snapshot.status === "completed" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {snapshot.status === "completed" ? "Completed" : "Failed"}
            </span>
          ))}
          {row("Type", TYPE_LABELS[snapshot.snapshot_type] ?? snapshot.snapshot_type)}
          {row("Description", snapshot.description || "—")}
          {row("Included Data", (
            <div className="flex flex-wrap gap-1 justify-end">
              {snapshot.included_modules.length > 0
                ? snapshot.included_modules.map((m) => (
                    <span key={m} className="badge-navy text-[10px]">{MODULE_LABELS[m] ?? m}</span>
                  ))
                : "—"}
            </div>
          ))}
          {row("Records", snapshot.record_count.toLocaleString())}
          {row("File Size", formatBytes(snapshot.size_bytes))}
          {row("Created By", snapshot.created_by_email ?? "—")}
          {row("Created At", new Date(snapshot.created_at).toLocaleString())}
          {snapshot.status === "failed" && snapshot.error_message && (
            row("Error", <span className="text-[var(--err)]">{snapshot.error_message}</span>)
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="btn-outline">Close</button>
          {snapshot.file && (
            <a href={snapshot.file} target="_blank" rel="noopener noreferrer" className="btn-gold flex items-center gap-2">
              <Download size={14} /> Download
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
