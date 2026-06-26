"use client";
import {
  GraduationCap, Users, Plus,
  BarChart2, FileText, CreditCard, CalendarDays, Star, UserCog,
} from "lucide-react";
import { useStudents, useTeachers, useInvoices, useAcademicYears, useSchoolProfile,
  useGuardians, useClasses, useSubjects, useAttendance, useNotifications } from "@/hooks/useApi";
import { useAuthStore } from "@/store/auth.store";
import { QueryError } from "@/components/shared/QueryError";
import { TeacherDeadlinesCard } from "@/components/dashboard/TeacherDeadlinesCard";
import Link from "next/link";
import type { UserRole } from "@/types";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const getDisplayName = (email: string): string => {
  const local = email.split("@")[0];
  return local
    .split(".")
    .map((part) =>
      part.length === 1
        ? part.toUpperCase() + "."
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin:           "Administrator",
  teacher:         "Teacher",
  finance_officer: "Finance Officer",
  student:         "Student",
  guardian:        "Guardian",
};

const ROLE_SUBTITLE: Record<UserRole, string> = {
  admin:           "Here's your school at a glance.",
  teacher:         "Here are your classes and students.",
  finance_officer: "Here's your financial overview.",
  student:         "Here are your academic updates.",
  guardian:        "Here are your child's updates.",
};

const ALL_ACTIONS: {
  href: string; icon: React.ElementType; label: string;
  desc: string; color: string; roles: UserRole[];
}[] = [
  { href: "/students",     icon: GraduationCap, label: "Enrol Student",    desc: "Add to registry",    color: "bg-[var(--gold-pale)] text-[var(--gold-dim)]", roles: ["admin"] },
  { href: "/students",     icon: GraduationCap, label: "My Students",      desc: "View class roster",  color: "bg-[var(--gold-pale)] text-[var(--gold-dim)]", roles: ["teacher"] },
  { href: "/marks",        icon: BarChart2,      label: "Enter Marks",      desc: "Record scores",      color: "bg-[var(--navy-pale)] text-navy",               roles: ["admin", "teacher"] },
  { href: "/attendance",   icon: CalendarDays,   label: "Attendance",       desc: "Daily per-subject",  color: "bg-[var(--ok-bg)] text-[var(--ok)]",            roles: ["admin", "teacher"] },
  { href: "/report-cards", icon: FileText,       label: "Report Cards",     desc: "Full PDF reports",   color: "bg-[var(--navy-pale)] text-navy",               roles: ["admin", "teacher"] },
  { href: "/finance",      icon: CreditCard,     label: "Create Invoice",   desc: "Fee billing",        color: "bg-[#FDF0D0] text-[var(--gold-dim)]",           roles: ["finance_officer"] },
  { href: "/finance",      icon: CreditCard,     label: "Finance Overview", desc: "View invoices",      color: "bg-[#FDF0D0] text-[var(--gold-dim)]",           roles: ["admin"] },
  { href: "/finance",      icon: CreditCard,     label: "View Invoices",    desc: "Track payments",     color: "bg-[#FDF0D0] text-[var(--gold-dim)]",           roles: ["finance_officer"] },
  { href: "/conduct",      icon: Star,           label: "Conduct Ratings",  desc: "14 categories",      color: "bg-[var(--err-bg)] text-[var(--err)]",          roles: ["admin", "teacher"] },
  { href: "/users",        icon: UserCog,        label: "User Management",  desc: "Manage accounts",    color: "bg-[var(--navy-pale)] text-navy",               roles: ["admin"] },
  { href: "/report-cards", icon: FileText,       label: "My Report Card",   desc: "View your grades",   color: "bg-[var(--navy-pale)] text-navy",               roles: ["student"] },
  { href: "/report-cards", icon: FileText,       label: "Child's Progress", desc: "Grades & conduct",   color: "bg-[var(--navy-pale)] text-navy",               roles: ["guardian"] },
  { href: "/students",     icon: GraduationCap,  label: "Student Registry", desc: "Browse students",    color: "bg-[var(--gold-pale)] text-[var(--gold-dim)]", roles: ["finance_officer"] },
  { href: "/guardians",    icon: Users,          label: "Guardians",        desc: "Parent contacts",    color: "bg-[var(--navy-pale)] text-navy",               roles: ["admin"] },
];

export default function DashboardPage() {
  const { user, role } = useAuthStore();
  const { data: school } = useSchoolProfile();
  const currentRole = (role ?? "admin") as UserRole;

  const isAdmin          = currentRole === "admin";
  const isFinanceOfficer = currentRole === "finance_officer";
  const isTeacher        = currentRole === "teacher";
  const isStudent        = currentRole === "student";
  const isGuardian       = currentRole === "guardian";
  const needsFinance     = isAdmin || isFinanceOfficer;
  const needsStudents    = isAdmin || isFinanceOfficer || isTeacher;
  const today            = new Date().toISOString().split("T")[0];

  const displayName  = user?.first_name || (user ? getDisplayName(user.email) : "");
  const roleLabel    = ROLE_LABEL[currentRole];
  const roleSubtitle = ROLE_SUBTITLE[currentRole];
  const visibleActions = ALL_ACTIONS.filter((a) => a.roles.includes(currentRole)).slice(0, 6);

  // ── Role-gated API calls ──────────────────────────────────────
  // Never fetch data a role has no business seeing.
  // Students enabled for everyone — the backend scopes it (student → own,
  // guardian → linked children) so the banner can show role-relevant counts.
  const {
    data: students, isLoading: studentsLoading,
    isError: studentsError, refetch: refetchStudents,
  } = useStudents({ page_size: 500 }, { enabled: true });

  const {
    data: teachers, isLoading: teachersLoading,
    isError: teachersError, refetch: refetchTeachers,
  } = useTeachers(undefined, { enabled: isAdmin });

  // Guardians also need their own invoices (outstanding balance metric).
  const {
    data: invoices, isLoading: invoicesLoading,
    isError: invoicesError, refetch: refetchInvoices,
  } = useInvoices({ page_size: 1000 }, { enabled: needsFinance || isGuardian });

  const { data: years, isError: yearsError, refetch: refetchYears } = useAcademicYears();

  // ── Extra, role-gated data for the greeting-banner metrics ────────
  const { data: guardians }   = useGuardians({ page_size: 1 }, { enabled: isAdmin });
  const { data: classesData } = useClasses(undefined, { enabled: isTeacher });
  const { data: subjectsData } = useSubjects({ enabled: isTeacher || isStudent });
  // Today's attendance for admin/teacher; a student's own recent records for %.
  const { data: todayAtt }    = useAttendance((isAdmin || isTeacher) ? { date: today, page_size: 300 } : undefined);
  const { data: myAtt }       = useAttendance(isStudent ? { page_size: 300 } : undefined);
  const { data: latestNotifs } = useNotifications({ page_size: 1 });
  const { data: attAlerts }    = useNotifications({ module: "Attendance", is_read: false, page_size: 1 });

  // Only flag loading/error for queries this role actually made
  const isLoading = (needsStudents && studentsLoading) || (isAdmin && teachersLoading) || (needsFinance && invoicesLoading);
  const hasError  = (needsStudents && studentsError) || (isAdmin && teachersError) || (needsFinance && invoicesError) || yearsError;
  const retryAll  = () => {
    if (needsStudents) refetchStudents();
    if (isAdmin)       refetchTeachers();
    if (needsFinance)  refetchInvoices();
    refetchYears();
  };

  // ── Derived stats ─────────────────────────────────────────────
  const totalStudents = students?.count ?? 0;
  const totalTeachers = teachers?.count ?? 0;

  const allInvoices   = invoices?.results ?? [];
  const totalInvoiced = allInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid     = allInvoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const outstanding   = totalInvoiced - totalPaid;
  const collRate      = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  const currentYear = years?.results?.find((y) => y.is_current);

  // ── Greeting-banner metrics (role-specific, compact) ──────────
  const fmtMoney = (n: number) => `L$${Math.round(n).toLocaleString()}`;
  const guardianCount = guardians?.count ?? 0;

  // finance
  const todaysPayments = allInvoices.reduce((s, inv) =>
    s + (inv.payments ?? [])
          .filter((p) => String(p.payment_date ?? "").slice(0, 10) === today)
          .reduce((a, p) => a + Number(p.amount), 0), 0);
  const pendingInvoices = allInvoices.filter((i) => i.status !== "paid").length;

  // teacher
  const assignedClasses = classesData?.count ?? 0;
  const markedToday = new Set((todayAtt?.results ?? []).map((a) => a.class_group)).size;
  const pendingAttendance = Math.max(0, assignedClasses - markedToday);

  // student
  const studentClass = students?.results?.[0]?.class_name ?? "—";
  const myAttRecords = myAtt?.results ?? [];
  const studentPresent = myAttRecords.filter((a) => a.status === "present").length;
  const studentAttPct = myAttRecords.length ? `${Math.round((studentPresent / myAttRecords.length) * 100)}%` : "—";

  // guardian
  const latestNotifTitle = latestNotifs?.results?.[0]?.title ?? "None yet";
  const attentionCount = attAlerts?.count ?? 0;

  type Metric = { label: string; value: string };
  const bannerMetrics: Metric[] = (() => {
    if (isAdmin) return [
      { label: "Students",     value: String(totalStudents) },
      { label: "Teachers",     value: String(totalTeachers) },
      { label: "Guardians",    value: String(guardianCount) },
      { label: "Marked Today", value: String(todayAtt?.count ?? 0) },
    ];
    if (isFinanceOfficer) return [
      { label: "Outstanding",      value: fmtMoney(outstanding) },
      { label: "Today's Payments", value: fmtMoney(todaysPayments) },
      { label: "Pending Invoices", value: String(pendingInvoices) },
      { label: "Collection",       value: `${collRate}%` },
    ];
    if (isTeacher) return [
      { label: "My Classes",         value: String(assignedClasses) },
      { label: "My Students",        value: String(totalStudents) },
      { label: "Pending Attendance", value: String(pendingAttendance) },
      { label: "Marked Today",       value: String(markedToday) },
    ];
    if (isStudent) return [
      { label: "Class",        value: studentClass },
      { label: "Subjects",     value: String(subjectsData?.count ?? 0) },
      { label: "Attendance",   value: studentAttPct },
      { label: "Present Days", value: String(studentPresent) },
    ];
    return [ // guardian
      { label: "Children",    value: String(totalStudents) },
      { label: "Outstanding", value: fmtMoney(outstanding) },
      { label: "Att. Alerts", value: String(attentionCount) },
      { label: "Latest",      value: latestNotifTitle },
    ];
  })();


  const showFinancePanel = needsFinance;

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Dashboard</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              {getGreeting()}, {displayName} — {roleSubtitle}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {isAdmin && (
              <>
                <Link href="/students" className="btn-outline flex items-center gap-1.5">
                  <GraduationCap size={15} /> All Students
                </Link>
                <Link href="/students" className="btn-gold flex items-center gap-1.5">
                  <Plus size={15} /> Enrol Student
                </Link>
              </>
            )}
            {isTeacher && (
              <Link href="/marks" className="btn-gold flex items-center gap-1.5">
                <BarChart2 size={15} /> Enter Marks
              </Link>
            )}
            {isFinanceOfficer && (
              <Link href="/finance" className="btn-gold flex items-center gap-1.5">
                <CreditCard size={15} /> Manage Finance
              </Link>
            )}
            {currentRole === "student" && (
              <Link href="/report-cards" className="btn-gold flex items-center gap-1.5">
                <FileText size={15} /> My Report Card
              </Link>
            )}
            {currentRole === "guardian" && (
              <Link href="/report-cards" className="btn-gold flex items-center gap-1.5">
                <FileText size={15} /> View Progress
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="page-content space-y-5">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0D1A33] via-[#1A2A4A] to-[#1E3560] p-8 sm:p-10 shadow-[0_20px_60px_rgba(13,26,51,0.35)]">
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(200,168,75,0.12)_0%,transparent_70%)] pointer-events-none" />
          <div className="absolute bottom-[-40px] left-[-40px] w-64 h-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0%,transparent_70%)] pointer-events-none" />
          <div className="absolute top-6 right-8 opacity-10">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="20" y="0" width="8" height="48" rx="4" fill="#C8A84B"/>
              <rect x="0" y="16" width="48" height="8" rx="4" fill="#C8A84B"/>
            </svg>
          </div>
          <div className="relative">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[rgba(200,168,75,0.7)] uppercase mb-2">
              {school?.school_name || "Sacred Heart Catholic High School"}
            </p>
            <h2 className="text-white font-serif text-2xl sm:text-3xl font-semibold leading-tight">
              {getGreeting()},<br />
              <span className="text-[#E8C96A]">{displayName}</span>
            </h2>
            <p className="text-[rgba(200,168,75,0.6)] text-xs font-semibold uppercase tracking-widest mt-1">
              {roleLabel}
            </p>
            <p className="text-[rgba(255,255,255,0.5)] text-sm mt-2 font-light italic">
              &ldquo;Ora et Labora&rdquo; · Faith, Excellence &amp; Service · Monrovia, Liberia
            </p>
            {/* Compact role-specific metrics — fills the banner meaningfully */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6">
              {bannerMetrics.map((m) => (
                <div key={m.label} className="rounded-xl bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.12)] px-3.5 py-3 backdrop-blur-sm min-w-0">
                  <p className="text-white font-bold text-lg leading-tight truncate" title={m.value}>
                    {isLoading ? "…" : m.value}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.55)] mt-0.5 truncate">{m.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[rgba(255,255,255,0.4)] mt-3">
              {currentYear?.name ?? "2025/2026"} · Semester 2 Active
            </p>
          </div>
        </div>

        {hasError && (
          <div className="card">
            <QueryError resource="dashboard data" onRetry={retryAll} />
          </div>
        )}

        {/* Bottom section — layout adapts to whether Finance panel is shown */}
        <div className={`grid grid-cols-1 gap-5 ${showFinancePanel ? "lg:grid-cols-3" : ""}`}>
          {/* Quick Actions */}
          <div className={`card overflow-hidden ${showFinancePanel ? "lg:col-span-2" : ""}`}>
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-navy">Quick Actions</h3>
              <span className="text-[11px] text-[var(--muted)] font-medium capitalize">{roleLabel} shortcuts</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {visibleActions.map((a) => (
                <Link
                  key={`${a.href}-${a.label}`}
                  href={a.href}
                  className="flex flex-col gap-2.5 p-4 rounded-xl border border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${a.color} transition-colors`}>
                    <a.icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy leading-tight">{a.label}</p>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Finance Overview — admin and finance_officer only */}
          {showFinancePanel && (
            <div className="card flex flex-col gap-0">
              <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="font-serif text-lg font-semibold text-navy">Finance Overview</h3>
                <Link href="/finance" className="text-xs font-semibold text-[var(--gold-dim)] hover:text-[var(--gold)] transition-colors">
                  View all →
                </Link>
              </div>
              <div className="p-6 flex-1 space-y-5">
                {/* SVG donut ring */}
                <div className="text-center py-4">
                  <div className="relative inline-flex items-center justify-center">
                    <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="var(--surface2)" strokeWidth="8" />
                      <circle
                        cx="40" cy="40" r="32"
                        fill="none"
                        stroke="var(--gold)"
                        strokeWidth="8"
                        strokeDasharray={`${collRate * 2.01} 201`}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    </svg>
                    <span className="absolute text-lg font-bold font-mono text-navy">{collRate}%</span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--muted)] mt-2 uppercase tracking-wider">Collection Rate</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Total Invoiced", value: `L$${totalInvoiced.toLocaleString()}`, color: "text-navy" },
                    { label: "Collected",      value: `L$${totalPaid.toLocaleString()}`,     color: "text-[var(--ok)]" },
                    { label: "Outstanding",    value: `L$${outstanding.toLocaleString()}`,   color: "text-[var(--err)]" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                      <span className="text-xs text-[var(--muted)] font-medium">{row.label}</span>
                      <span className={`text-sm font-bold font-mono ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <Link href="/finance" className="btn-gold w-full justify-center text-xs py-2.5">
                  Manage Finance →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Teacher: active academic tasks & deadline countdowns (Phase 4) */}
        {isTeacher && <TeacherDeadlinesCard />}
      </div>
    </>
  );
}
