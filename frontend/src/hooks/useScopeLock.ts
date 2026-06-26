import { useTaskWindows } from "./useApi";
import { useAuthStore } from "@/store/auth.store";
import type { AcademicTaskWindow, TaskType } from "@/lib/api/services";

const specificity = (w: AcademicTaskWindow) =>
  [w.semester, w.assigned_class, w.subject, w.teacher].filter((v) => v != null).length;

export interface ScopeLockArgs {
  taskTypes: TaskType[];
  classId?: number | null;
  subjectId?: number | null;
  /** Semester IDs to match (any of these, or a wildcard window). Empty = match
   *  any semester (used where the page only knows the semester *number*). */
  semesterIds?: (number | null | undefined)[];
}

/**
 * Client mirror of the backend `find_locking_window`: returns the
 * AcademicTaskWindow currently BLOCKING a teacher write to this scope, or null
 * if unrestricted. Most-specific matching window decides (ties → latest update),
 * using the server-computed `effective_status`. Only meaningful for teachers —
 * admins bypass locks server-side, so this always returns null for them.
 */
export function useScopeLock({ taskTypes, classId, subjectId, semesterIds }: ScopeLockArgs): AcademicTaskWindow | null {
  const role = useAuthStore((s) => s.role);
  const { data } = useTaskWindows();

  if (role !== "teacher" || !classId) return null;

  const sems = (semesterIds ?? []).filter((v): v is number => v != null);
  const matches = (data?.results ?? []).filter((w) =>
    taskTypes.includes(w.task_type) &&
    (w.assigned_class == null || w.assigned_class === classId) &&
    (w.subject == null || w.subject === (subjectId ?? null)) &&
    (w.semester == null || sems.length === 0 || sems.includes(w.semester)),
  );
  if (!matches.length) return null;

  matches.sort((a, b) => specificity(b) - specificity(a) || (a.updated_at < b.updated_at ? 1 : -1));
  const top = matches[0];
  return top.effective_status === "open" ? null : top;
}
