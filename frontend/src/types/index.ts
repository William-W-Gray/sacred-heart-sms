// ═══════════════════════════════════════════════════════════════
// Sacred Heart SMS — Shared TypeScript Types
// Mirrors every Django model 1-to-1
// ═══════════════════════════════════════════════════════════════

// ── Auth ────────────────────────────────────────────────────────
export type UserRole = "admin" | "finance_officer" | "teacher" | "student" | "guardian";

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  date_joined: string;
}

export interface JWTPayload {
  user_id: number;
  email: string;
  role: UserRole;
  exp: number;
  iat: number;
}

// ── Academic structure ───────────────────────────────────────────
export interface AcademicYear {
  id: number;
  name: string;          // "2025/2026"
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface Semester {
  id: number;
  academic_year: number;
  number: 1 | 2;
  start_date: string;
  end_date: string;
  is_active: boolean;
  marks_locked: boolean;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

export interface ClassGroup {
  id: number;
  name: string;               // "12A"
  grade: number;
  section: string;
  academic_year: number;
  class_teacher: number | null;
  class_teacher_name: string | null;
  student_count: number;
}

// ── People ───────────────────────────────────────────────────────
export type Gender = "M" | "F";
export type StudentStatus = "active" | "suspended" | "transferred" | "graduated" | "withdrawn";

export interface Guardian {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  address: string;
  occupation: string;
}

export interface StudentGuardianLink {
  id: number;
  name: string;
  phone: string;
  email: string;
  relationship: string;
  is_primary: boolean;
}

export interface Student {
  id: number;
  student_id: string;         // custom, e.g. "CHS-2026-001"
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;          // computed
  gender: Gender;
  date_of_birth: string | null;
  photo: string | null;
  current_class: number | null;
  class_name: string | null;
  current_class_detail: ClassGroup | null;
  status: StudentStatus;
  enrolled_at: string;
  updated_at: string;
  guardians: StudentGuardianLink[];
}

export interface Teacher {
  id: number;
  full_name: string;
  email: string;
  phone_number: string;
  department: string;
  employee_id: string;
  photo: string | null;
  is_active: boolean;
  class_id: number | null;
  subjects: number[];
}

export interface TeacherAssignment {
  id: number;
  teacher: number;
  assigned_class: number;
  subject: number;
  academic_year: number;
  is_active: boolean;
}

// ── Marks ────────────────────────────────────────────────────────
export type GradeLetter = "A" | "B" | "C" | "D" | "F";

export interface GradingScale {
  id: number;
  academic_year: number;
  grade_letter: GradeLetter;
  min_score: number;
  max_score: number;
  description: string;
  gpa_points: number;
}

export interface Mark {
  id: number;
  student: number;
  subject: number;
  semester: number;
  test_score: number | null;
  exam_score: number | null;
  semester_average: number | null;
  is_locked: boolean;
  recorded_by: number | null;
  updated_at: string;
}

// ── Conduct ──────────────────────────────────────────────────────
export interface ConductCategory {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface ConductRating {
  id: number;
  student: number;
  category: number;
  category_name?: string;
  semester: number;
  rating: 1 | 2 | 3 | 4 | 5 | 6;
  notes: string;
  updated_at: string;
}

// ── Attendance ───────────────────────────────────────────────────
export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export interface AttendanceRecord {
  id: number;
  student: number;
  subject: number;
  class_group: number;
  date: string;
  status: AttendanceStatus;
  recorded_by: number | null;
  notes: string;
}

export interface AttendanceSummary {
  student: number;
  semester: number;
  total_days: number;
  days_present: number;
  days_late: number;
  days_absent: number;
  days_excused: number;
  attendance_rate: number;
}

// ── Promotion ────────────────────────────────────────────────────
export type PromotionDecisionType = "promoted" | "conditioned" | "retained" | "not_returning";

export interface PromotionDecision {
  id: number;
  student: number;
  academic_year: number;
  current_class: number;
  next_class: number | null;
  decision: PromotionDecisionType;
  decided_by: number | null;
  reason: string;
  decided_at: string;
}

// ── Finance ──────────────────────────────────────────────────────
export type InvoiceStatus = "pending" | "partial" | "paid" | "overdue" | "cancelled";
export type PaymentMethod = "cash" | "bank_transfer" | "mobile_money" | "cheque";

export interface Invoice {
  id: number;
  invoice_number: string;
  student: number;
  student_name?: string;
  student_sid?: string;
  semester: number | null;
  fee_type: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  amount_paid: number;
  balance: number;
  notes: string;
  created_at: string;
}

export interface Payment {
  id: number;
  invoice: number;
  amount: number;
  method: PaymentMethod;
  reference_number: string;
  payment_date: string;
  is_verified: boolean;
  notes: string;
  created_at: string;
}

// ── Report Card ──────────────────────────────────────────────────
export interface ReportCardSubject {
  subject: string;
  s1_test: number | null;
  s1_exam: number | null;
  s1_average: number | null;
  s2_test: number | null;
  s2_exam: number | null;
  s2_average: number | null;
  year_average: number | null;
  grade: GradeLetter | null;
}

export interface ReportCard {
  student: {
    id: number;
    student_id: string;
    full_name: string;
    gender: string;
    date_of_birth: string | null;
    class: string | null;
  };
  academic_year: string;
  subjects: ReportCardSubject[];
  conduct: { category: string; rating: number }[];
  attendance: {
    total: number | null;
    present: number | null;
    absent: number | null;
    late: number | null;
  };
  ranking: {
    rank: number | null;
    class_size: number | null;
    year_average: number | null;
  };
  promotion: {
    decision: PromotionDecisionType | null;
    decision_display: string | null;
  };
}

// ── Notifications ────────────────────────────────────────────────
export interface Notification {
  id: number;
  notification_type: string;
  channel: "in_app" | "email" | "whatsapp";
  title: string;
  body: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── API helpers ──────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  [key: string]: string | string[] | undefined;
}
