import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  studentsApi, guardiansApi, teachersApi, classesApi, subjectsApi,
  academicYearsApi, semestersApi, attendanceApi, marksApi, conductApi,
  promotionsApi, financeApi, notificationsApi, usersApi, authApi, trashApi, snapshotsApi,
  auditApi, schoolApi, assessmentTemplatesApi, reportCardTemplateApi,
  academicTaskWindowsApi,
  type CreateUserPayload, type AuditLogParams, type SchoolProfile,
  type AssessmentTemplate, type ReportCardTemplate, type AcademicTaskWindow,
} from "@/lib/api/services";
import { keepPreviousData } from "@tanstack/react-query";
import type { Student, PromotionDecision } from "@/types";

// ── Query key factory ────────────────────────────────────────────
export const QK = {
  users:       (p?: object) => ["users", p] as const,
  students:    (p?: object) => ["students", p] as const,
  student:     (id: number) => ["students", id] as const,
  reportCard:  (id: number) => ["report-card", id] as const,
  guardians:   (p?: object) => ["guardians", p] as const,
  teachers:    (p?: object) => ["teachers", p] as const,
  assignments: (p?: object) => ["teacher-assignments", p] as const,
  classes:     (p?: object) => ["classes", p] as const,
  subjects:    ()           => ["subjects"] as const,
  years:       ()           => ["academic-years"] as const,
  semesters:   (p?: object) => ["semesters", p] as const,
  marks:       (p?: object) => ["marks", p] as const,
  scales:      (p?: object) => ["grading-scales", p] as const,
  conductCats: ()           => ["conduct-categories"] as const,
  conductRat:  (p?: object) => ["conduct-ratings", p] as const,
  promotions:  (p?: object) => ["promotions", p] as const,
  attendance:  (p?: object) => ["attendance", p] as const,
  attSummary:  (p?: object) => ["attendance-summary", p] as const,
  feeTypes:    (p?: object) => ["fee-types", p] as const,
  invoices:    (p?: object) => ["invoices", p] as const,
  payments:    (p?: object) => ["payments", p] as const,
  notifications: (p?: object) => ["notifications", p] as const,
  trash:       (p?: object) => ["trash", p] as const,
  snapshots:   (p?: object) => ["snapshots", p] as const,
  auditLogs:   (p?: object) => ["audit-logs", p] as const,
  auditMeta:   ()           => ["audit-logs", "meta"] as const,
  schoolProfile: ()         => ["school-profile"] as const,
  reportCardTemplate: ()    => ["report-card-template"] as const,
  assessmentTemplates: (p?: object) => ["assessment-templates", p] as const,
  taskWindows: (p?: object) => ["academic-task-windows", p] as const,
  profile:     ()           => ["profile"] as const,
};

// ── Students ─────────────────────────────────────────────────────
export const useStudents = (params?: Record<string, unknown>, opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: QK.students(params), queryFn: () => studentsApi.list(params), enabled: opts?.enabled ?? true });

export const useStudent = (id: number) =>
  useQuery({ queryKey: QK.student(id), queryFn: () => studentsApi.get(id), enabled: !!id });

export const useReportCard = (id: number, enabled = true) =>
  useQuery({ queryKey: QK.reportCard(id), queryFn: () => studentsApi.reportCard(id), enabled: !!id && enabled });

export const useCreateStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: FormData | Partial<Student>) => studentsApi.create(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
};

export const useUpdateStudent = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: FormData | Partial<Student>) => studentsApi.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: QK.student(id) });
    },
  });
};

export const useDeleteStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => studentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

// Finance officer: place / lift an academic finance hold on a student.
export const useSetFinanceHold = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ hold, reason }: { hold: boolean; reason?: string }) =>
      studentsApi.setFinanceHold(id, hold, reason ?? ""),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: QK.student(id) });
    },
  });
};

// ── Teachers ─────────────────────────────────────────────────────
export const useTeachers = (params?: Record<string, unknown>, opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: QK.teachers(params), queryFn: () => teachersApi.list(params), enabled: opts?.enabled ?? true });

export const useCreateTeacher = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teachersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });
};

export const useUpdateTeacher = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Parameters<typeof teachersApi.update>[1]) => teachersApi.update(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });
};

export const useDeleteTeacher = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teachersApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

// ── Guardians ────────────────────────────────────────────────────
export const useGuardians = (params?: Record<string, unknown>, opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: QK.guardians(params), queryFn: () => guardiansApi.list(params), enabled: opts?.enabled ?? true });

export const useCreateGuardian = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: guardiansApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: ["guardians"] }) });
};

export const useUpdateGuardian = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...d }: { id: number } & Partial<import("@/types").Guardian>) => guardiansApi.update(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guardians"] }),
  });
};

export const useDeleteGuardian = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => guardiansApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guardians"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

export const useSetGuardianStudents = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      guardianId,
      links,
    }: {
      guardianId: number;
      links: { student: number; relationship: string; is_primary: boolean }[];
    }) => guardiansApi.setStudents(guardianId, links),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guardians"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
};

// ── Academic structure ───────────────────────────────────────────
export const useClasses = (params?: Record<string, unknown>, opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: QK.classes(params), queryFn: () => classesApi.list(params), enabled: opts?.enabled ?? true });

export const useSubjects = (opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: QK.subjects(), queryFn: () => subjectsApi.list(), enabled: opts?.enabled ?? true });

export const useAcademicYears = () =>
  useQuery({ queryKey: QK.years(), queryFn: () => academicYearsApi.list() });

export const useSemesters = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.semesters(params), queryFn: () => semestersApi.list(params) });

export const useCreateClass = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: classesApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }) });
};

export const useCreateSubject = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: subjectsApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }) });
};

export const useDeleteSubject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: subjectsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

// ── Marks ────────────────────────────────────────────────────────
export const useMarks = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.marks(params), queryFn: () => marksApi.list(params) });

export const useSaveMarksBulk = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: marksApi.bulkSave,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marks"] }),
  });
};

export const useGradingScales = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.scales(params), queryFn: () => marksApi.gradingScales.list(params) });

// ── Attendance ───────────────────────────────────────────────────
export const useAttendance = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.attendance(params), queryFn: () => attendanceApi.list(params), enabled: !!params });

export const useSaveAttendanceBulk = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.bulkUpsert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
};

// ── Conduct ──────────────────────────────────────────────────────
export const useConductCategories = () =>
  useQuery({ queryKey: QK.conductCats(), queryFn: conductApi.categories.list });

export const useConductRatings = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.conductRat(params), queryFn: () => conductApi.ratings.list(params), enabled: !!params });

export const useSaveConductBulk = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: conductApi.ratings.bulkSave,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conduct-ratings"] }),
  });
};

// ── Promotions ───────────────────────────────────────────────────
export const usePromotions = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.promotions(params), queryFn: () => promotionsApi.list(params) });

export const useUpsertPromotion = () => {
  const qc = useQueryClient();
  return useMutation({
    // A student already has a decision for this academic year as soon as
    // one's been saved once (unique_together on the backend) — POSTing
    // again would always 400, so update in place when we have an id.
    mutationFn: ({ id, ...d }: Partial<PromotionDecision>) =>
      id ? promotionsApi.update(id, d) : promotionsApi.create(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotions"] }),
  });
};

// ── Finance ──────────────────────────────────────────────────────
export const useInvoices = (params?: Record<string, unknown>, opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: QK.invoices(params), queryFn: () => financeApi.invoices.list(params), enabled: opts?.enabled ?? true });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.invoices.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const useAssignFees = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Record<string, unknown>) => financeApi.invoices.assign(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const useCreatePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.payments.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.invoices.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

// ── Fee types (admin + finance officer) ──────────────────────────
export const useFeeTypes = (params?: Record<string, unknown>, opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: QK.feeTypes(params), queryFn: () => financeApi.feeTypes.list(params), enabled: opts?.enabled ?? true });

export const useCreateFeeType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.feeTypes.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-types"] }),
  });
};

export const useUpdateFeeType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...d }: { id: number } & Partial<import("@/types").FeeType>) =>
      financeApi.feeTypes.update(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-types"] }),
  });
};

export const useDeleteFeeType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.feeTypes.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-types"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

// ── Notifications ────────────────────────────────────────────────
export const useNotifications = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: QK.notifications(params),
    queryFn:  () => notificationsApi.list(params),
    refetchInterval: 30_000, // poll every 30 s
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn:  () => notificationsApi.unreadCount(),
    refetchInterval: 30_000,
  });

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

// ── Users (admin management) ─────────────────────────────────────
export const useUsers = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.users(params), queryFn: () => usersApi.list(params) });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CreateUserPayload) => usersApi.create(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...d }: { id: number } & Record<string, unknown>) =>
      usersApi.update(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

export const useResetUserPassword = () =>
  useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      usersApi.adminResetPassword(id, password),
  });

export const useForceLogout = () =>
  useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      usersApi.forceLogout(id, reason),
  });

// ── My Settings / self-service profile (all roles) ───────────────
export const useProfile = () =>
  useQuery({ queryKey: QK.profile(), queryFn: () => usersApi.getProfile() });

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: FormData | Record<string, unknown>) => usersApi.updateProfile(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.profile() }),
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: ({ old_password, new_password }: { old_password: string; new_password: string }) =>
      authApi.changePassword(old_password, new_password),
  });

// ── Trash (admin-only) ────────────────────────────────────────────
export const useTrash = (params?: { type?: string }) =>
  useQuery({ queryKey: QK.trash(params), queryFn: () => trashApi.list(params) });

export const useRestoreFromTrash = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) => trashApi.restore(type, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash"] });
      // The restored record could be any of these — cheap to invalidate
      // them all rather than track exactly which one per type.
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["teachers"] });
      qc.invalidateQueries({ queryKey: ["guardians"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["marks"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["promotions"] });
      qc.invalidateQueries({ queryKey: ["conduct-ratings"] });
    },
  });
};

export const usePurgeFromTrash = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) => trashApi.purge(type, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trash"] }),
  });
};

// ── Snapshots (admin-only) ────────────────────────────────────────
export const useSnapshots = () =>
  useQuery({ queryKey: QK.snapshots(), queryFn: () => snapshotsApi.list() });

export const useCreateSnapshot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof snapshotsApi.create>[0]) => snapshotsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

export const useDeleteSnapshot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => snapshotsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
};

// ── Audit trail (admin-only) ──────────────────────────────────────
export const useAuditLogs = (params?: AuditLogParams) =>
  useQuery({
    queryKey: QK.auditLogs(params),
    queryFn: () => auditApi.list(params),
    // keep the previous page visible while the next one loads — avoids the
    // table flashing empty on every page/filter change.
    placeholderData: keepPreviousData,
  });

export const useAuditMeta = () =>
  useQuery({ queryKey: QK.auditMeta(), queryFn: () => auditApi.meta(), staleTime: 60_000 });

// ── School profile (singleton settings) ───────────────────────────
export const useSchoolProfile = () =>
  useQuery({ queryKey: QK.schoolProfile(), queryFn: () => schoolApi.get(), staleTime: 60_000 });

export const useUpdateSchoolProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FormData | Partial<SchoolProfile>) => schoolApi.update(payload),
    onSuccess: (data) => qc.setQueryData(QK.schoolProfile(), data),
  });
};

// ── Report card template (singleton settings) ─────────────────────
export const useReportCardTemplate = () =>
  useQuery({ queryKey: QK.reportCardTemplate(), queryFn: () => reportCardTemplateApi.get(), staleTime: 60_000 });

export const useUpdateReportCardTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ReportCardTemplate>) => reportCardTemplateApi.update(payload),
    onSuccess: (data) => qc.setQueryData(QK.reportCardTemplate(), data),
  });
};

// ── Grading / assessment templates (admin-defined) ────────────────
export const useAssessmentTemplates = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.assessmentTemplates(params), queryFn: () => assessmentTemplatesApi.list(params) });

export const useCreateAssessmentTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<AssessmentTemplate>) => assessmentTemplatesApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-templates"] }),
  });
};

export const useUpdateAssessmentTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AssessmentTemplate> }) =>
      assessmentTemplatesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-templates"] }),
  });
};

export const useDeleteAssessmentTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentTemplatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-templates"] }),
  });
};

// ── Academic task windows (Phase 4: admin-set deadlines) ──────────
export const useTaskWindows = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.taskWindows(params), queryFn: () => academicTaskWindowsApi.list(params) });

export const useCreateTaskWindow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<AcademicTaskWindow>) => academicTaskWindowsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic-task-windows"] }),
  });
};

export const useUpdateTaskWindow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AcademicTaskWindow> }) =>
      academicTaskWindowsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic-task-windows"] }),
  });
};

export const useDeleteTaskWindow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => academicTaskWindowsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic-task-windows"] }),
  });
};
