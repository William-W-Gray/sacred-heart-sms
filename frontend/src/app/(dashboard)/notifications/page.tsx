"use client";
import { useState } from "react";
import { CheckCheck, Bell } from "lucide-react";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import type { Notification, NotificationPriority } from "@/types";

const PRIO: Record<NotificationPriority, { dot: string; label: string }> = {
  urgent: { dot: "bg-[var(--err)]",   label: "Urgent" },
  high:   { dot: "bg-[var(--gold)]",  label: "High" },
  normal: { dot: "bg-navy/40",        label: "Normal" },
  low:    { dot: "bg-[var(--muted)]", label: "Low" },
};
const MODULES = ["Attendance", "Marks", "Finance", "Academic Deadlines"];

const fmt = (iso: string) => new Date(iso).toLocaleString();

export default function NotificationsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"" | "unread" | "read">("");
  const [moduleFilter, setModule] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params: Record<string, unknown> = { page_size: 100 };
  if (status) params.is_read = status === "read";
  if (moduleFilter) params.module = moduleFilter;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, isError, refetch, isLoading } = useNotifications(params);
  const markRead = useMarkRead();
  const markAll  = useMarkAllRead();

  const items: Notification[] = data?.results ?? [];

  const handleMarkAll = async () => {
    try { await markAll.mutateAsync(); toast({ title: "All notifications marked as read", variant: "success" }); }
    catch { toast({ title: "Failed to mark all read", variant: "error" }); }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Notifications</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">Your alerts across attendance, marks, finance and deadlines</p>
          </div>
          <button onClick={handleMarkAll} disabled={markAll.isPending} className="btn-outline flex items-center gap-2 disabled:opacity-60">
            <CheckCheck size={15} /> Mark all read
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap mt-4">
          <select value={status} onChange={(e) => setStatus(e.target.value as "" | "unread" | "read")} className="form-input w-full sm:w-36 text-sm">
            <option value="">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
          <select value={moduleFilter} onChange={(e) => setModule(e.target.value)} className="form-input w-full sm:w-48 text-sm">
            <option value="">All modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="form-input w-full sm:w-40 text-sm" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="form-input w-full sm:w-40 text-sm" title="To date" />
        </div>
      </div>

      <div className="page-content">
        {isError ? (
          <div className="card"><QueryError resource="notifications" onRetry={refetch} /></div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] text-xs text-[#5A6A8A]">
              {isLoading ? "Loading…" : `${items.length} notification${items.length === 1 ? "" : "s"}`}
            </div>
            <div className="divide-y divide-[var(--border)]">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.is_read) markRead.mutate(n.id); }}
                  className={`w-full text-left px-5 py-4 flex gap-3 hover:bg-[var(--surface)] transition-colors ${n.is_read ? "" : "bg-[var(--gold-pale)]/40"}`}
                >
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${n.is_read ? "bg-[var(--border-strong)]" : (PRIO[n.priority]?.dot ?? "bg-navy/40")}`} title={PRIO[n.priority]?.label} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-sm ${n.is_read ? "text-[#5A6A8A]" : "text-navy font-semibold"}`}>{n.title}</p>
                      <span className="text-[11px] text-[#8A9ABB] flex-shrink-0">{fmt(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-[#5A6A8A] mt-1">{n.body}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {n.module && <span className="text-[9px] uppercase tracking-wide font-semibold text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded px-1.5 py-0.5">{n.module}</span>}
                      {n.priority !== "normal" && <span className={`text-[9px] uppercase tracking-wide font-semibold text-white rounded px-1.5 py-0.5 ${PRIO[n.priority]?.dot}`}>{PRIO[n.priority]?.label}</span>}
                      {!n.is_read && <span className="text-[10px] text-[var(--gold-dim)] font-medium">● Unread</span>}
                    </div>
                  </div>
                </button>
              ))}
              {!isLoading && items.length === 0 && (
                <div className="px-5 py-16 text-center text-[#8A9ABB]">
                  <Bell size={28} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No notifications match these filters.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
