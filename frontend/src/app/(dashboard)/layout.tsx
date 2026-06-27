"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, GraduationCap, Users, UserCheck,
  CalendarDays, BarChart2, Star, Trophy, FileText,
  CreditCard, School, Settings, Bell, LogOut, ChevronRight, ChevronLeft,
  ChevronDown, Menu, X, UserCog, Trash2, Archive, ScrollText, Timer, CircleUser, Tag,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/shared/Avatar";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { SessionTimeoutGuard } from "@/components/shared/SessionTimeoutGuard";
import type { UserRole } from "@/types";

type NavItem = { href: string; icon: React.ElementType; label: string; roles?: UserRole[] };
type NavSection = { label: string; items: NavItem[]; roles?: UserRole[] };

const NAV: NavSection[] = [
  { label: "Overview", items: [
    { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard" },
    { href: "/notifications", icon: Bell,            label: "Notifications" },
    { href: "/my-settings",   icon: CircleUser,      label: "My Settings" },
  ]},
  { label: "People", roles: ["admin", "teacher", "finance_officer"], items: [
    { href: "/students",  icon: GraduationCap, label: "Students" },
    // Teacher Management is admin-only per spec — teachers must not see it
    // (overrides the older "world-readable staff directory" posture). The
    // backend already 403s teacher writes; this hides the menu entry too.
    { href: "/teachers",  icon: UserCheck,     label: "Teachers", roles: ["admin"] },
    { href: "/guardians", icon: Users,          label: "Guardians", roles: ["admin"] },
  ]},
  { label: "Academic", roles: ["admin", "teacher"], items: [
    { href: "/attendance",  icon: CalendarDays, label: "Attendance" },
    { href: "/marks",       icon: BarChart2,    label: "Marks Entry" },
    { href: "/conduct",     icon: Star,         label: "Conduct" },
    // Promotion decisions are admin-only at the API (PromotionDecisionViewSet
    // .get_permissions()) — teachers reaching this page couldn't save
    // anything anyway, so don't show them a page that only half-works.
    { href: "/promotion",   icon: Trophy,       label: "Promotion", roles: ["admin"] },
  ]},
  { label: "Reports", roles: ["admin", "teacher", "student", "guardian"], items: [
    { href: "/report-cards", icon: FileText, label: "Report Cards" },
  ]},
  { label: "Finance", roles: ["admin", "finance_officer"], items: [
    { href: "/finance",           icon: CreditCard, label: "Finance" },
    { href: "/finance/fee-types", icon: Tag,        label: "Fee Types" },
  ]},
  { label: "Finance", roles: ["student", "guardian"], items: [
    { href: "/my-finance", icon: CreditCard, label: "My Finance" },
  ]},
  { label: "Admin", roles: ["admin"], items: [
    { href: "/users",     icon: UserCog,    label: "User Management" },
    { href: "/classes",   icon: School,     label: "Classes & Subjects" },
    { href: "/deadlines", icon: Timer,      label: "Academic Deadlines" },
    { href: "/audit",     icon: ScrollText, label: "Audit Trail" },
    { href: "/trash",     icon: Trash2,     label: "Trash" },
    { href: "/snapshots", icon: Archive,    label: "Snapshots" },
    { href: "/settings",  icon: Settings,   label: "Settings" },
  ]},
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, role, isAuthenticated, logout, fetchMe, hasHydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop-only icons-only mode (mobile always shows the full drawer when
  // open — collapsing it there wouldn't save anything, the drawer is
  // already hidden by default). Read synchronously so there's no flash of
  // the wrong width on first paint.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sms-sidebar-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sms-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  // Per-category collapse/expand. Stored in localStorage (a UI preference,
  // unlike auth — sharing it across tabs is harmless and expected). A section
  // missing from the map defaults to open, so first-time users see everything.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("sms-sidebar-sections") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    localStorage.setItem("sms-sidebar-sections", JSON.stringify(openSections));
  }, [openSections]);
  const toggleSection = (label: string) =>
    setOpenSections((s) => ({ ...s, [label]: !(s[label] ?? true) }));

  useEffect(() => {
    // Wait for the persisted auth flag to rehydrate from localStorage —
    // on the very first render after a hard reload `isAuthenticated` is
    // still the default `false`, which would otherwise bounce an
    // actually-logged-in user to /login before rehydration lands.
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (!user) {
      // user object is not persisted in localStorage — re-fetch after page refresh
      fetchMe();
    } else if (role) {
      // Check if user has permission to access the current pathname —
      // both the section's roles AND the specific item's own (more
      // specific) roles must allow it, e.g. "/teachers" sits under the
      // "People" section (admin/teacher/finance_officer) but the item
      // itself further restricts to admin/teacher only.
      let isAuthorized = true;
      for (const section of NAV) {
        const item = section.items.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
        if (item) {
          if (section.roles && !section.roles.includes(role as UserRole)) {
            isAuthorized = false;
          }
          if (item.roles && !item.roles.includes(role as UserRole)) {
            isAuthorized = false;
          }
          break;
        }
      }
      if (!isAuthorized) {
        router.replace("/dashboard");
      }
    }
  }, [hasHydrated, isAuthenticated, user, role, pathname, fetchMe, router]);

  // If fetchMe() gave up because the connection was down (it keeps the
  // session alive rather than logging out — see auth.store.ts), retry as
  // soon as the browser reports connectivity back instead of leaving the
  // user stuck on the skeleton below.
  useEffect(() => {
    if (!isAuthenticated || user) return;
    window.addEventListener("online", fetchMe);
    return () => window.removeEventListener("online", fetchMe);
  }, [isAuthenticated, user, fetchMe]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const skeleton = (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center">
      <div className="space-y-3 w-64">
        <div className="skeleton h-5 w-48 rounded-lg" />
        <div className="skeleton h-3 w-32 rounded-lg" />
        <div className="skeleton h-3 w-40 rounded-lg" />
      </div>
    </div>
  );

  // Still rehydrating — don't trust `isAuthenticated` yet (see auth.store.ts).
  if (!hasHydrated) return skeleton;

  if (!isAuthenticated) return null;

  // Authenticated but the profile hasn't been re-fetched yet (first render
  // after a page refresh, since `user` itself isn't persisted).
  if (!user) return skeleton;

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
      <OfflineBanner />
      <SessionTimeoutGuard />
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 flex-shrink-0 bg-[#FAFAF8] border-r border-[var(--border)] flex flex-col overflow-y-auto transition-[width,transform] duration-200 ease-in-out",
          "lg:static lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-60",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className={cn("px-5 py-5 border-b border-[var(--border)] flex items-center justify-between", collapsed && "lg:px-0 lg:justify-center")}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A] flex items-center justify-center shadow-[0_2px_8px_rgba(200,168,75,0.4)] flex-shrink-0">
              <span className="text-navy-deep font-bold text-base font-serif">SH</span>
            </div>
            <div className={cn(collapsed && "lg:hidden")}>
              <p className="text-xs font-bold text-navy tracking-tight leading-tight">Sacred Heart</p>
              <p className="text-[10px] text-[var(--muted)] leading-tight font-medium">Catholic High School · SMS</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-[13px] -m-[13px] rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-navy transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden lg:flex items-center justify-center w-full py-2 border-b border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-navy transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-5">
          {NAV.filter((s) => !s.roles || (role && s.roles.includes(role as UserRole))).map((section) => {
            const isOpen = openSections[section.label] ?? true;
            return (
            <div key={section.label}>
              {/* Category header doubles as a collapse toggle. Hidden in the
                  desktop icon-only mode (there's no header to expand there).
                  On mobile the full drawer always shows it, so category
                  collapse works regardless of the desktop icon mode. */}
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                aria-expanded={isOpen}
                className={cn(
                  "w-full flex items-center justify-between px-2 mb-1.5 group/section rounded-md hover:bg-white/60 transition-colors",
                  collapsed && "lg:hidden",
                )}
              >
                <span className="text-[11px] font-semibold tracking-widest text-[var(--muted)] uppercase">
                  {section.label}
                </span>
                <ChevronDown
                  size={12}
                  className={cn(
                    "text-[var(--muted)] transition-transform duration-200 group-hover/section:text-navy",
                    !isOpen && "-rotate-90",
                  )}
                />
              </button>
              {/* Items: hidden when the category is collapsed, EXCEPT in the
                  desktop icon-only mode where headers are gone and icons must
                  always show (hence the lg:block override). */}
              <div className={cn("space-y-0.5", !isOpen && "hidden", !isOpen && collapsed && "lg:block")}>
                {section.items
                  .filter((item) => !item.roles || (role && item.roles.includes(role as UserRole)))
                  .map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "flex items-center gap-2.5 py-2.5 rounded-lg text-sm transition-all duration-150",
                        active
                          ? "bg-gradient-to-r from-navy to-navy-light text-white font-medium shadow-sm border-l-2 border-[var(--gold)] pl-[9px] pr-2.5"
                          : "text-[#5A6A8A] hover:bg-white hover:text-navy hover:shadow-[var(--shadow-xs)] px-2.5",
                        collapsed && "lg:justify-center lg:px-0 lg:border-l-0",
                      )}
                    >
                      <item.icon size={15} className={cn("flex-shrink-0", active ? "text-[var(--gold)]" : "text-[var(--muted)]")} />
                      <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] space-y-2">
          {/* User identity */}
          <div className={cn("flex items-center gap-2.5 px-2 py-2", collapsed && "lg:justify-center lg:px-0")} title={`${user.email}${user.first_name ? ` (${user.first_name} ${user.last_name})` : ""}`}>
            <Avatar src={user.photo_url} firstName={user.first_name} lastName={user.last_name} email={user.email} size={32} />
            <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
              <p className="text-xs font-semibold text-navy truncate">
                {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.email}
              </p>
              <p className="text-[10px] text-[var(--muted)] truncate">{user.email}</p>
            </div>
          </div>
          {/* Academic year */}
          <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--gold-pale)] border border-[rgba(200,168,75,0.2)]", collapsed && "lg:justify-center lg:px-0")} title="2025/2026 · Semester 2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] flex-shrink-0" />
            <span className={cn("text-[11px] font-semibold text-[var(--gold-dim)]", collapsed && "lg:hidden")}>2025/2026 · Semester 2</span>
          </div>
          {/* Sign out */}
          <button
            onClick={handleLogout}
            title="Sign out"
            className={cn("w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-[var(--muted)] hover:bg-white hover:text-navy rounded-lg transition-all group", collapsed && "lg:justify-center lg:px-0")}
          >
            <LogOut size={13} className="group-hover:text-[var(--err)] transition-colors flex-shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-navy-deep border-b border-[rgba(200,168,75,0.15)] flex items-center justify-between gap-3 px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-3 -m-3 rounded-lg text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-[rgba(255,255,255,0.5)] min-w-0">
              <span className="truncate">Sacred Heart SMS</span>
              <ChevronRight size={12} className="flex-shrink-0" />
              <span className="text-white font-medium capitalize truncate">
                {pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") ?? "Dashboard"}
              </span>
            </div>
            <span className="sm:hidden text-white text-sm font-medium capitalize truncate">
              {pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") ?? "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Notification bell + dropdown */}
            <NotificationBell />
            {/* Role badge */}
            <span className="hidden sm:inline-flex text-[11px] font-medium text-gold-light border border-[rgba(200,168,75,0.3)] bg-[rgba(200,168,75,0.1)] px-2.5 py-1 rounded-full uppercase tracking-wider">
              {role}
            </span>
            {/* Avatar → My Settings */}
            <Link href="/my-settings" title="My Settings" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity">
              <Avatar src={user.photo_url} firstName={user.first_name} lastName={user.last_name} email={user.email} size={32} />
              <span className="hidden md:inline text-sm text-[rgba(255,255,255,0.75)] truncate max-w-[160px]">
                {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.email}
              </span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
