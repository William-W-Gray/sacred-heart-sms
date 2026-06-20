import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  studentsApi, guardiansApi, teachersApi, classesApi, subjectsApi,
  academicYearsApi, semestersApi, attendanceApi, marksApi, conductApi,
  promotionsApi, financeApi, notificationsApi, usersApi,
  type CreateUserPayload,
} from "@/lib/api/services";
import type { Student, UserRole } from "@/types";

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
  invoices:    (p?: object) => ["invoices", p] as const,
  payments:    (p?: object) => ["payments", p] as const,
  notifications: ()         => ["notifications"] as const,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });
};

// ── Guardians ────────────────────────────────────────────────────
export const useGuardians = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.guardians(params), queryFn: () => guardiansApi.list(params) });

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guardians"] }),
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
export const useClasses = (params?: Record<string, unknown>) =>
  useQuery({ queryKey: QK.classes(params), queryFn: () => classesApi.list(params) });

export const useSubjects = () =>
  useQuery({ queryKey: QK.subjects(), queryFn: () => subjectsApi.list() });

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
  return useMutation({ mutationFn: subjectsApi.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }) });
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
    mutationFn: (d: Parameters<typeof promotionsApi.create>[0]) => promotionsApi.create(d),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

// ── Notifications ────────────────────────────────────────────────
export const useNotifications = () =>
  useQuery({
    queryKey: QK.notifications(),
    queryFn:  () => notificationsApi.list(),
    refetchInterval: 30_000, // poll every 30 s
  });

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
    mutationFn: ({ id, ...d }: { id: number; role?: UserRole; is_active?: boolean }) =>
      usersApi.update(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};
