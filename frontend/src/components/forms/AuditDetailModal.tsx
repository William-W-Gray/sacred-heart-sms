"use client";
import { X } from "lucide-react";
import type { AuditLog } from "@/lib/api/services";

interface Props {
  log: AuditLog | null;
  onClose: () => void;
}

function ValueBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  const isEmpty = value == null || (typeof value === "object" && Object.keys(value).length === 0);
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">{label}</p>
      {isEmpty ? (
        <div className="text-xs text-[var(--muted)] italic px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">—</div>
      ) : (
        <pre className="text-[11px] leading-relaxed text-navy whitespace-pre-wrap break-words px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] max-h-60 overflow-auto font-mono">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AuditDetailModal({ log, onClose }: Props) {
  if (!log) return null;

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border)] last:border-0">
      <span className="text-xs font-medium text-[var(--muted)] flex-shrink-0">{label}</span>
      <span className="text-sm text-navy text-right break-words min-w-0">{value}</span>
    </div>
  );

  const showDiff = log.old_value != null || log.new_value != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
          <div className="min-w-0 pr-4">
            <h2 className="text-xl font-semibold text-navy font-serif">Audit Entry</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{log.description || log.action_display}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--surface)] text-[#5A6A8A] transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-1">
          {row("Action", <span className="badge-navy">{log.action_display}</span>)}
          {row("Module", log.module || "—")}
          {row("Performed By", (
            <span className="break-all">{log.actor_name}{log.actor_role && <span className="text-[var(--muted)]"> ({log.actor_role})</span>}</span>
          ))}
          {row("Object", log.object_name ? `${log.object_name}${log.object_id ? ` (#${log.object_id})` : ""}` : "—")}
          {row("Description", <span className="break-words">{log.description || "—"}</span>)}
          {row("IP Address", <span className="font-mono break-all">{log.ip_address || "—"}</span>)}
          {row("User Agent", <span className="font-mono text-[11px] break-all">{log.user_agent || "—"}</span>)}
          {row("Timestamp", new Date(log.timestamp).toLocaleString())}
        </div>

        {showDiff && (
          <div className="px-6 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ValueBlock label="Before" value={log.old_value} />
              <ValueBlock label="After" value={log.new_value} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)] sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-outline">Close</button>
        </div>
      </div>
    </div>
  );
}
