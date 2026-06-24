import api from "./client";
import type {
  AuthTokens, AuthUser, AcademicYear, Semester, ClassGroup, Subject,
  Student, Guardian, Teacher, TeacherAssignment,
  Mark, GradingScale, ConductCategory, ConductRating, PromotionDecision,
  AttendanceRecord, AttendanceSummary,
  Invoice, Payment,
  Notification, ReportCard,
  PaginatedResponse, UserRole,
} from "@/types";

// ── User management (admin only) ─────────────────────────────────
export interface ManagedUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  date_joined: string;
  profile_details?: Record<string, unknown> | null;
}
export interface CreateUserPayload {
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  password: string;
}
export const usersApi = {
  list:   (p?: Record<string, unknown>) => api.get<{ results: ManagedUser[]; count: number }>("/api/users/", { params: p }).then((r) => r.data),
  create: (d: CreateUserPayload) => api.post<ManagedUser>("/api/users/", d).then((r) => r.data),
  update: (id: number, d: Record<string, unknown>) =>
    api.patch<ManagedUser>(`/api/users/${id}/`, d).then((r) => r.data),
  delete: (id: number) => api.delete(`/api/users/${id}/`).then((r) => r.data),
  /** Admin force-reset: sets a new password without needing the old one */
  adminResetPassword: (id: number, new_password: string) =>
    api.post(`/api/users/${id}/reset-password/`, { password: new_password }).then((r) => r.data),
};

// ── Generic helpers ──────────────────────────────────────────────
const list   = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<PaginatedResponse<T>>(url, { params }).then((r) => r.data);
const all    = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<T[]>(url, { params }).then((r) => r.data);
const one    = <T>(url: string) => api.get<T>(url).then((r) => r.data);
const create = <T>(url: string, data: unknown) => api.post<T>(url, data).then((r) => r.data);
const update = <T>(url: string, data: unknown) => api.patch<T>(url, data).then((r) => r.data);
const del    = (url: string) => api.delete(url).then((r) => r.data);

// ── Auth ─────────────────────────────────────────────────────────
export const authApi = {
  login:   (email: string, password: string) =>
    api.post<AuthTokens>("/api/auth/login/", { email, password }).then((r) => r.data),
  refresh: (refresh: string) =>
    api.post<{ access: string }>("/api/auth/refresh/", { refresh }).then((r) => r.data),
  logout:  (refresh: string) =>
    api.post("/api/auth/logout/", { refresh }),
  me:      () => one<AuthUser>("/api/users/me/"),
  changePassword: (old_password: string, new_password: string) =>
    api.post("/api/users/change-password/", { old_password, new_password }),
  // Unauthenticated, unthrottled ping to wake a sleeping Render instance /
  // suspended Neon compute before the user finishes typing their password,
  // so the login POST itself doesn't eat the cold-start latency.
  warmUp:  () => api.get("/api/health/"),
};

// ── Academic structure ───────────────────────────────────────────
export const academicYearsApi = {
  list:       (p?: Record<string, unknown>) => list<AcademicYear>("/api/academic-years/", p),
  current:    () => all<AcademicYear>("/api/academic-years/", { is_current: true }),
  get:        (id: number) => one<AcademicYear>(`/api/academic-years/${id}/`),
  create:     (d: Partial<AcademicYear>) => create<AcademicYear>("/api/academic-years/", d),
  update:     (id: number, d: Partial<AcademicYear>) => update<AcademicYear>(`/api/academic-years/${id}/`, d),
  delete:     (id: number) => del(`/api/academic-years/${id}/`),
};

export const semestersApi = {
  list:   (p?: Record<string, unknown>) => list<Semester>("/api/semesters/", p),
  get:    (id: number) => one<Semester>(`/api/semesters/${id}/`),
  create: (d: Partial<Semester>) => create<Semester>("/api/semesters/", d),
  update: (id: number, d: Partial<Semester>) => update<Semester>(`/api/semesters/${id}/`, d),
};

export const classesApi = {
  list:   (p?: Record<string, unknown>) => list<ClassGroup>("/api/classes/", p),
  get:    (id: number) => one<ClassGroup>(`/api/classes/${id}/`),
  create: (d: Partial<ClassGroup>) => create<ClassGroup>("/api/classes/", d),
  update: (id: number, d: Partial<ClassGroup>) => update<ClassGroup>(`/api/classes/${id}/`, d),
  delete: (id: number) => del(`/api/classes/${id}/`),
};

export const subjectsApi = {
  list:   (p?: Record<string, unknown>) => list<Subject>("/api/subjects/", p),
  create: (d: Partial<Subject>) => create<Subject>("/api/subjects/", d),
  update: (id: number, d: Partial<Subject>) => update<Subject>(`/api/subjects/${id}/`, d),
  delete: (id: number) => del(`/api/subjects/${id}/`),
};

// ── Students ─────────────────────────────────────────────────────
export const studentsApi = {
  list:       (p?: Record<string, unknown>) => list<Student>("/api/students/", p),
  get:        (id: number) => one<Student>(`/api/students/${id}/`),
  create:     (d: FormData | Partial<Student>) =>
    api.post<Student>("/api/students/", d, {
      headers: d instanceof FormData ? { "Content-Type": "multipart/form-data" } : {},
    }).then((r) => r.data),
  update:     (id: number, d: FormData | Partial<Student>) =>
    api.patch<Student>(`/api/students/${id}/`, d, {
      headers: d instanceof FormData ? { "Content-Type": "multipart/form-data" } : {},
    }).then((r) => r.data),
  delete:     (id: number) => del(`/api/students/${id}/`),
  reportCard: (id: number) => one<ReportCard>(`/api/students/${id}/report_card/`),
};

// ── Guardians ────────────────────────────────────────────────────
export const guardiansApi = {
  list:   (p?: Record<string, unknown>) => list<Guardian>("/api/guardians/", p),
  get:    (id: number) => one<Guardian>(`/api/guardians/${id}/`),
  create: (d: Partial<Guardian>) => create<Guardian>("/api/guardians/", d),
  update: (id: number, d: Partial<Guardian>) => update<Guardian>(`/api/guardians/${id}/`, d),
  delete: (id: number) => del(`/api/guardians/${id}/`),
  setStudents: (
    guardianId: number,
    links: { student: number; relationship: string; is_primary: boolean }[],
  ) => api.post(`/api/guardians/${guardianId}/set-students/`, { links }).then((r) => r.data),
};

// ── Teachers ─────────────────────────────────────────────────────
export const teachersApi = {
  list:   (p?: Record<string, unknown>) => list<Teacher>("/api/teachers/", p),
  get:    (id: number) => one<Teacher>(`/api/teachers/${id}/`),
  create: (d: Partial<Teacher>) => create<Teacher>("/api/teachers/", d),
  update: (id: number, d: Partial<Teacher>) => update<Teacher>(`/api/teachers/${id}/`, d),
  delete: (id: number) => del(`/api/teachers/${id}/`),
  assignments: {
    list:   (p?: Record<string, unknown>) => list<TeacherAssignment>("/api/teacher-assignments/", p),
    create: (d: Partial<TeacherAssignment>) => create<TeacherAssignment>("/api/teacher-assignments/", d),
    delete: (id: number) => del(`/api/teacher-assignments/${id}/`),
  },
};

// ── Attendance ───────────────────────────────────────────────────
export const attendanceApi = {
  list:   (p?: Record<string, unknown>) => list<AttendanceRecord>("/api/attendance/", p),
  create: (d: Partial<AttendanceRecord>) => create<AttendanceRecord>("/api/attendance/", d),
  update: (id: number, d: Partial<AttendanceRecord>) =>
    update<AttendanceRecord>(`/api/attendance/${id}/`, d),
  bulkUpsert: (records: Partial<AttendanceRecord>[]) =>
    api.post<AttendanceRecord[]>("/api/attendance/bulk/", { records }).then((r) => r.data),
  summary: (p?: Record<string, unknown>) => list<AttendanceSummary>("/api/attendance-summary/", p),
};

// ── Marks ────────────────────────────────────────────────────────
export const marksApi = {
  list:   (p?: Record<string, unknown>) => list<Mark>("/api/marks/", p),
  create: (d: Partial<Mark>) => create<Mark>("/api/marks/", d),
  update: (id: number, d: Partial<Mark>) => update<Mark>(`/api/marks/${id}/`, d),
  bulkSave: (records: Partial<Mark>[]) =>
    api.post<{ created: number; updated: number }>("/api/marks/bulk/", { records }).then((r) => r.data),
  gradingScales: {
    list:   (p?: Record<string, unknown>) => list<GradingScale>("/api/grading-scales/", p),
    update: (id: number, d: Partial<GradingScale>) =>
      update<GradingScale>(`/api/grading-scales/${id}/`, d),
  },
};

// ── Conduct ──────────────────────────────────────────────────────
export const conductApi = {
  categories: {
    list: () => list<ConductCategory>("/api/conduct-categories/"),
  },
  ratings: {
    list:     (p?: Record<string, unknown>) => list<ConductRating>("/api/conduct-ratings/", p),
    upsert:   (d: Partial<ConductRating>) => create<ConductRating>("/api/conduct-ratings/", d),
    bulkSave: (records: Partial<ConductRating>[]) =>
      api.post<ConductRating[]>("/api/conduct-ratings/bulk/", { records }).then((r) => r.data),
  },
};

// ── Promotions ───────────────────────────────────────────────────
export const promotionsApi = {
  list:   (p?: Record<string, unknown>) => list<PromotionDecision>("/api/promotions/", p),
  create: (d: Partial<PromotionDecision>) => create<PromotionDecision>("/api/promotions/", d),
  update: (id: number, d: Partial<PromotionDecision>) =>
    update<PromotionDecision>(`/api/promotions/${id}/`, d),
};

// ── Finance ──────────────────────────────────────────────────────
export const financeApi = {
  invoices: {
    list:   (p?: Record<string, unknown>) => list<Invoice>("/api/invoices/", p),
    get:    (id: number) => one<Invoice>(`/api/invoices/${id}/`),
    create: (d: Partial<Invoice>) => create<Invoice>("/api/invoices/", d),
    update: (id: number, d: Partial<Invoice>) => update<Invoice>(`/api/invoices/${id}/`, d),
    delete: (id: number) => del(`/api/invoices/${id}/`),
  },
  payments: {
    list:   (p?: Record<string, unknown>) => list<Payment>("/api/payments/", p),
    create: (d: Partial<Payment>) => create<Payment>("/api/payments/", d),
  },
};

// ── Notifications ────────────────────────────────────────────────
export const notificationsApi = {
  list:       (p?: Record<string, unknown>) => list<Notification>("/api/notifications/", p),
  markRead:   (id: number) => api.post(`/api/notifications/${id}/read/`),
  markAllRead: () => api.post("/api/notifications/read-all/"),
};
