import { Lock } from "lucide-react";
import type { AcademicTaskWindow } from "@/lib/api/services";

/** Read-only notice shown on entry grids when an admin deadline window has
 *  locked the selected scope for the current teacher. */
export function LockBanner({ window: w }: { window: AcademicTaskWindow }) {
  const state = w.effective_status === "readonly" ? "read-only" : "locked";
  return (
    <div className="card flex items-start gap-3 px-4 py-3 border-[var(--err-border)] bg-[var(--err-bg)]">
      <Lock size={16} className="text-[var(--err)] mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--err)]">This academic task is now locked.</p>
        <p className="text-xs text-[var(--err)] opacity-90 mt-0.5">
          {w.task_type_display} for this scope is {state}. Please contact the Admin for help.
          {w.note && <span className="italic"> — “{w.note}”</span>}
        </p>
      </div>
    </div>
  );
}
