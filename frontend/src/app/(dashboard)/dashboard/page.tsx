"use client";
import {
  GraduationCap, Users, TrendingUp, AlertCircle, Plus,
  BarChart2, FileText, CreditCard, CalendarDays, Star, UserCog,
} from "lucide-react";
import { useStudents, useTeachers, useInvoices, useAcademicYears } from "@/hooks/useApi";
import { useAuthStore } from "@/store/auth.store";
import { QueryError } from "@/components/shared/QueryError";
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
  { href: "/finance",      icon: CreditCard,     label: "Create Invoice",   desc: "Fee billing",        color: "bg-[#FDF0D0] text-[var(--gold-dim)]",           roles: ["admin", "finance_officer"] },
  { href: "/finance",      icon: CreditCard,     label: "View Invoices",    desc: "Track payments",     color: "bg-[#FDF0D0] text-[var(--gold-dim)]",           roles: ["finance_officer"] },
  { href: "/conduct",      icon: Star,           label: "Conduct Ratings",  desc: "14 categories",      color: "bg-[var(--err-bg)] text-[var(--err)]",          roles: ["admin", "teacher"] },
  { href: "/users",        icon: UserCog,        label: "User Management",  desc: "Manage accounts",    color: "bg-[var(--navy-pale)] text-navy",               roles: ["admin"] },
  { href: "/report-cards", icon: FileText,       label: "My Report Card",   desc: "View your grades",   color: "bg-[var(--navy-pale)] text-navy",               roles: ["student"] },
  { href: "/report-cards", icon: FileText,       label: "Child's Progress", desc: "Grades & conduct",   color: "bg-[var(--navy-pale)] text-navy",               roles: ["guardian"] },
  { href: "/students",     icon: GraduationCap,  label: "Student Registry", desc: "Browse students",    color: "bg-[var(--gold-pale)] text-[var(--gold-dim)]", roles: ["finance_officer"] },
  { href: "/guardians",    icon: Users,          label: "Guardians",        desc: "Parent contacts",    color: "bg-[var(--navy-pale)] text-navy",               roles: ["admin"] },
];

function StatCard({
  label, value, change, changeType, icon: Icon, bubble, isLoading,
}: {
  label: string; value: string; change?: string;
  changeType?: "up" | "down" | "neutral"; icon: React.ElementType; bubble: string; isLoading?: boolean;
}) {
  return (
    <div className="card-lift p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bubble} shadow-md`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      {isLoading ? (
        <>
          <div className="skeleton h-8 w-24 mb-2" />
          <div className="skeleton h-3 w-32" />
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-navy font-mono leading-none">{value}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mt-1">{label}</p>
          {change && (
            <p className={`text-xs mt-2 ${
              changeType === "up"   ? "text-[var(--ok)]"  :
              changeType === "down" ? "text-[var(--err)]" : "text-[var(--muted)]"
            }`}>{change}</p>
          )}
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, role } = useAuthStore();
  const currentRole = (role ?? "admin") as UserRole;

  const isAdmin          = currentRole === "admin";
  const isFinanceOfficer = currentRole === "finance_officer";
  const isTeacher        = currentRole === "teacher";
  const needsFinance     = isAdmin || isFinanceOfficer;
  const needsStudents    = isAdmin || isFinanceOfficer || isTeacher;

  const displayName  = user?.first_name || (user ? getDisplayName(user.email) : "");
  const roleLabel    = ROLE_LABEL[currentRole];
  const roleSubtitle = ROLE_SUBTITLE[currentRole];
  const visibleActions = ALL_ACTIONS.filter((a) => a.roles.includes(currentRole)).slice(0, 6);

  // ── Role-gated API calls ──────────────────────────────────────
  // Never fetch data a role has no business seeing.
  const {
    data: students, isLoading: studentsLoading,
    isError: studentsError, refetch: refetchStudents,
  } = useStudents(undefined, { enabled: needsStudents });

  const {
    data: teachers, isLoading: teachersLoading,
    isError: teachersError, refetch: refetchTeachers,
  } = useTeachers(undefined, { enabled: isAdmin });

  const {
    data: invoices, isLoading: invoicesLoading,
    isError: invoicesError, refetch: refetchInvoices,
  } = useInvoices({ page_size: 1000 }, { enabled: needsFinance });

  const { data: years, isError: yearsError, refetch: refetchYears } = useAcademicYears();

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
  const overdueCount  = allInvoices.filter((i) => i.status === "overdue").length;

  const currentYear = years?.results?.find((y) => y.is_current);

  // ── Role-specific hero chips ──────────────────────────────────
  const heroChips = (() => {
    const yearChip = { icon: "📅", label: currentYear?.name ?? "2025/2026" };
    const semChip  = { icon: "✦",  label: "Semester 2 Active" };
    if (isAdmin)
      return [yearChip, semChip, { icon: "👨‍🎓", label: `${totalStudents} Students Enrolled` }, { icon: "👩‍🏫", label: `${totalTeachers} Teaching Staff` }];
    if (isFinanceOfficer)
      return [yearChip, semChip, { icon: "👨‍🎓", label: `${totalStudents} Students` }, { icon: "💰", label: "Finance Officer" }];
    if (isTeacher)
      return [yearChip, semChip, { icon: "👨‍🎓", label: `${totalStudents} My Students` }, { icon: "📚", label: "Educator" }];
    if (currentRole === "student")
      return [yearChip, semChip, { icon: "🎓", label: "Student" }, { icon: "✝️", label: "Sacred Heart" }];
    return [yearChip, semChip, { icon: "👨‍👩‍👧", label: "Guardian" }, { icon: "✝️", label: "Sacred Heart" }];
  })();

  // ── Role-specific stat card definitions ───────────────────────
  type CardDef = {
    label: string; value: string; change: string;
    changeType: "up" | "down" | "neutral"; icon: React.ElementType; bubble: string;
  };

  const statCards: CardDef[] = (() => {
    if (isAdmin) return [
      { label: "Total Students", value: String(totalStudents), change: "Active enrolments",       changeType: "neutral", icon: GraduationCap, bubble: "bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A]" },
      { label: "Teaching Staff", value: String(totalTeachers), change: "Across all departments",  changeType: "neutral", icon: Users,         bubble: "bg-gradient-to-br from-[#1A2A4A] to-[#2A3F6A]" },
      { label: "Fee Collection", value: `${collRate}%`,        change: `L$${totalPaid.toLocaleString()} collected`, changeType: "up", icon: TrendingUp, bubble: "bg-gradient-to-br from-[#1B6B3A] to-[#2A9D5C]" },
      { label: "Outstanding",    value: `L$${outstanding.toLocaleString()}`, change: `${overdueCount} overdue ${overdueCount === 1 ? "invoice" : "invoices"}`, changeType: overdueCount > 0 ? "down" : "neutral", icon: AlertCircle, bubble: "bg-gradient-to-br from-[#8B1A1A] to-[#C42B2B]" },
    ];
    if (isFinanceOfficer) return [
      { label: "Total Students",   value: String(totalStudents),            change: "For billing purposes",     changeType: "neutral", icon: GraduationCap, bubble: "bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A]" },
      { label: "Fees Collected",   value: `L$${totalPaid.toLocaleString()}`, change: `${collRate}% collection rate`, changeType: "up", icon: TrendingUp, bubble: "bg-gradient-to-br from-[#1B6B3A] to-[#2A9D5C]" },
      { label: "Outstanding Fees", value: `L$${outstanding.toLocaleString()}`, change: "Pending collection",   changeType: outstanding > 0 ? "down" : "neutral", icon: AlertCircle, bubble: "bg-gradient-to-br from-[#8B1A1A] to-[#C42B2B]" },
      { label: "Overdue Invoices", value: String(overdueCount),             change: overdueCount > 0 ? "Require follow-up" : "None overdue", changeType: overdueCount > 0 ? "down" : "neutral", icon: AlertCircle, bubble: "bg-gradient-to-br from-[#7A3A1A] to-[#B85A2B]" },
    ];
    if (isTeacher) return [
      { label: "My Students", value: String(totalStudents), change: "In your assigned classes", changeType: "neutral", icon: GraduationCap, bubble: "bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A]" },
    ];
    return []; // student / guardian — no numeric stats
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
              Sacred Heart Catholic High School
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
            <div className="flex flex-wrap gap-2 mt-5">
              {heroChips.map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[rgba(255,255,255,0.75)] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] px-3 py-1.5 rounded-full backdrop-blur-sm"
                >
                  <span className="opacity-70">{chip.icon}</span> {chip.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stat cards — only shown when there is something role-relevant to display */}
        {statCards.length > 0 && (
          hasError ? (
            <div className="card">
              <QueryError resource="dashboard data" onRetry={retryAll} />
            </div>
          ) : (
            <div className={`grid gap-4 ${
              statCards.length === 4 ? "grid-cols-2 lg:grid-cols-4" :
              statCards.length === 2 ? "grid-cols-1 sm:grid-cols-2"  :
              "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}>
              {statCards.map((c) => (
                <StatCard key={c.label} {...c} isLoading={isLoading} />
              ))}
            </div>
          )
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
      </div>
    </>
  );
}
