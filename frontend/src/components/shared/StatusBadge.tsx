// StatusBadge.tsx
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:       "badge-ok",
    suspended:    "badge-err",
    transferred:  "badge-gray",
    graduated:    "badge-navy",
    withdrawn:    "badge-gray",
    paid:         "badge-ok",
    partial:      "badge-warn",
    overdue:      "badge-err",
    pending:      "badge-gray",
    promoted:     "badge-ok",
    conditioned:  "badge-warn",
    retained:     "badge-err",
    not_returning:"badge-gray",
  };
  const cls = map[status] ?? "badge-gray";
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`${cls} capitalize`}>{label}</span>;
}
