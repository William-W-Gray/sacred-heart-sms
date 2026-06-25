"use client";
import { useEffect, useMemo, useState } from "react";
import { ScrollText, Search, Eye, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useAuditLogs, useAuditMeta } from "@/hooks/useApi";
import { QueryError } from "@/components/shared/QueryError";
import { AuditDetailModal } from "@/components/forms/AuditDetailModal";
import type { AuditLog } from "@/lib/api/services";

const PAGE_SIZES = [5, 10, 20, 50, 100];

// Colour-codes the action chip. Anything not listed falls back to navy.
const ACTION_STYLE: Record<string, string> = {
  login:                  "bg-emerald-50 text-emerald-700 border-emerald-200",
  logout:                 "bg-slate-50 text-slate-600 border-slate-200",
  create:                 "bg-sky-50 text-sky-700 border-sky-200",
  update:                 "bg-amber-50 text-amber-700 border-amber-200",
  delete:                 "bg-rose-50 text-rose-700 border-rose-200",
  restore:                "bg-emerald-50 text-emerald-700 border-emerald-200",
  permanent_delete:       "bg-red-100 text-red-800 border-red-300",
  snapshot_create:        "bg-indigo-50 text-indigo-700 border-indigo-200",
  snapshot_restore:       "bg-indigo-50 text-indigo-700 border-indigo-200",
  settings_change:        "bg-violet-50 text-violet-700 border-violet-200",
  profile_update:         "bg-amber-50 text-amber-700 border-amber-200",
  role_permission_change: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  marks_entry:            "bg-teal-50 text-teal-700 border-teal-200",
  attendance_entry:       "bg-cyan-50 text-cyan-700 border-cyan-200",
  report_card_generation: "bg-blue-50 text-blue-700 border-blue-200",
  payment_create:         "bg-green-50 text-green-700 border-green-200",
  payment_edit:           "bg-amber-50 text-amber-700 border-amber-200",
  payment_void:           "bg-rose-50 text-rose-700 border-rose-200",
};

function ActionBadge({ action, label }: { action: string; label: string }) {
  const cls = ACTION_STYLE[action] ?? "bg-navy-pale text-navy border-navy/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

export default function AuditTrailPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [module, setModule] = useState("");
  const [actor, setActor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState<AuditLog | null>(null);

  // Debounce the free-text search so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(() => ({
    page, page_size: pageSize,
    ...(search ? { search } : {}),
    ...(action ? { action } : {}),
    ...(module ? { module } : {}),
    ...(actor ? { actor } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  }), [page, pageSize, search, action, module, actor, dateFrom, dateTo]);

  const { data, isLoading, isError, refetch, isFetching } = useAuditLogs(params);
  const { data: meta } = useAuditMeta();

  const logs = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const hasFilters = !!(search || action || module || actor || dateFrom || dateTo);
  const resetFilters = () => {
    setSearchInput(""); setSearch(""); setAction(""); setModule("");
    setActor(""); setDateFrom(""); setDateTo(""); setPage(1);
  };

  const onFilterChange = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1); };

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Audit Trail</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              A complete, read-only record of every important action taken in the system.
            </p>
          </div>
        </div>
      </div>

      <div className="page-content space-y-4">
        {/* Filters */}
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search description, object, IP…"
                className="form-input pl-9 w-full"
              />
            </div>
            <select value={action} onChange={(e) => onFilterChange(setAction)(e.target.value)} className="form-input">
              <option value="">All actions</option>
              {meta?.actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <select value={module} onChange={(e) => onFilterChange(setModule)(e.target.value)} className="form-input">
              <option value="">All modules</option>
              {meta?.modules.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={actor} onChange={(e) => onFilterChange(setActor)(e.target.value)} className="form-input">
              <option value="">All users</option>
              {meta?.actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <div>
              <label className="text-[11px] text-[var(--muted)] block mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => onFilterChange(setDateFrom)(e.target.value)} className="form-input w-full" />
            </div>
            <div>
              <label className="text-[11px] text-[var(--muted)] block mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => onFilterChange(setDateTo)(e.target.value)} className="form-input w-full" />
            </div>
            <div className="flex items-end">
              {hasFilters && (
                <button onClick={resetFilters} className="btn-outline flex items-center gap-1.5 text-sm">
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="card flex items-center justify-center h-48 text-sm text-[var(--muted)]">
            <span className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin mr-2" />
            Loading audit trail…
          </div>
        ) : isError ? (
          <div className="card"><QueryError resource="audit trail" onRetry={refetch} /></div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[920px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Time", "User", "Action", "Module", "Object", "Description", "IP", ""].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-[var(--muted)]">
                      <ScrollText size={26} className="mx-auto mb-2 opacity-40" />
                      No audit entries match these filters.
                    </td></tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                      <td className="px-4 py-3 text-xs text-[var(--muted)] font-mono whitespace-nowrap" title={new Date(log.timestamp).toLocaleString()}>
                        {new Date(log.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 max-w-[160px] truncate" title={`${log.actor_name} (${log.actor_role || "—"})`}>
                        <span className="text-navy">{log.actor_name}</span>
                      </td>
                      <td className="px-4 py-3"><ActionBadge action={log.action} label={log.action_display} /></td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] whitespace-nowrap">{log.module || "—"}</td>
                      <td className="px-4 py-3 max-w-[160px] truncate text-navy" title={log.object_name}>{log.object_name || "—"}</td>
                      <td className="px-4 py-3 max-w-[240px] truncate text-[var(--muted)]" title={log.description}>{log.description || "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] font-mono whitespace-nowrap" title={log.user_agent}>{log.ip_address || "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetail(log)}
                          className="p-1.5 rounded hover:bg-[var(--surface2)] text-[#5A6A8A] hover:text-navy transition-colors"
                          title="View details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer: row-count selector + pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="form-input py-1 px-2 text-xs w-auto"
                >
                  {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="ml-2">
                  {from}–{to} of {total}{isFetching && <span className="ml-1 opacity-60">· updating…</span>}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded hover:bg-white border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed text-navy"
                  title="Previous page"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-xs text-[var(--muted)] px-2 whitespace-nowrap">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded hover:bg-white border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed text-navy"
                  title="Next page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AuditDetailModal log={detail} onClose={() => setDetail(null)} />
    </>
  );
}
