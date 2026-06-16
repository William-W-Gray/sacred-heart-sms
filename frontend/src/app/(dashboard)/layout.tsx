"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, GraduationCap, Users, UserCheck,
  CalendarDays, BarChart2, Star, Trophy, FileText,
  CreditCard, School, Settings, Bell, LogOut, ChevronRight,
  Menu, X, UserCog,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useNotifications } from "@/hooks/useApi";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/types";

type NavItem = { href: string; icon: React.ElementType; label: string };
type NavSection = { label: string; items: NavItem[]; roles?: UserRole[] };

const NAV: NavSection[] = [
  { label: "Overview", items: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ]},
  { label: "People", roles: ["admin", "teacher", "finance_officer"], items: [
    { href: "/students",  icon: GraduationCap, label: "Students" },
    { href: "/teachers",  icon: UserCheck,     label: "Teachers" },
    { href: "/guardians", icon: Users,          label: "Guardians" },
  ]},
  { label: "Academic", roles: ["admin", "teacher"], items: [
    { href: "/attendance",  icon: CalendarDays, label: "Attendance" },
    { href: "/marks",       icon: BarChart2,    label: "Marks Entry" },
    { href: "/conduct",     icon: Star,         label: "Conduct" },
    { href: "/promotion",   icon: Trophy,       label: "Promotion" },
  ]},
  { label: "Reports", items: [
    { href: "/report-cards", icon: FileText, label: "Report Cards" },
  ]},
  { label: "Finance", roles: ["admin", "finance_officer"], items: [
    { href: "/finance", icon: CreditCard, label: "Finance" },
  ]},
  { label: "Admin", roles: ["admin"], items: [
    { href: "/users",    icon: UserCog, label: "User Management" },
    { href: "/classes",  icon: School,  label: "Classes & Subjects" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ]},
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, role, isAuthenticated, logout, fetchMe } = useAuthStore();
  const { data: notifData } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const unreadCount = notifData?.results?.filter((n) => !n.is_read).length ?? 0;

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (!user) {
      // user object is not persisted in localStorage — re-fetch after page refresh
      fetchMe();
    }
  }, [isAuthenticated, user, fetchMe, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!isAuthenticated) return null;

  // Show skeleton while user profile is re-fetched (first render after page refresh)
  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center">
        <div className="space-y-3 w-64">
          <div className="skeleton h-5 w-48 rounded-lg" />
          <div className="skeleton h-3 w-32 rounded-lg" />
          <div className="skeleton h-3 w-40 rounded-lg" />
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
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
          "fixed inset-y-0 left-0 z-40 w-60 flex-shrink-0 bg-[#FAFAF8] border-r border-[var(--border)] flex flex-col overflow-y-auto transition-transform duration-200 ease-in-out",
          "lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A] flex items-center justify-center shadow-[0_2px_8px_rgba(200,168,75,0.4)] flex-shrink-0">
              <span className="text-navy-deep font-bold text-base font-serif">SH</span>
            </div>
            <div>
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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-5">
          {NAV.filter((s) => !s.roles || (role && s.roles.includes(role as UserRole))).map((section) => (
            <div key={section.label}>
              <p className="text-[11px] font-semibold tracking-widest text-[var(--muted)] uppercase px-2 mb-1.5">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 py-2.5 rounded-lg text-sm transition-all duration-150",
                        active
                          ? "bg-gradient-to-r from-navy to-navy-light text-white font-medium shadow-sm border-l-2 border-[var(--gold)] pl-[9px] pr-2.5"
                          : "text-[#5A6A8A] hover:bg-white hover:text-navy hover:shadow-[var(--shadow-xs)] px-2.5",
                      )}
                    >
                      <item.icon size={15} className={active ? "text-[var(--gold)]" : "text-[var(--muted)]"} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] space-y-2">
          {/* User identity */}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A] flex items-center justify-center text-navy-deep font-bold text-xs flex-shrink-0">
              {user.first_name && user.last_name
                ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
                : user.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-navy truncate">
                {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.email}
              </p>
              <p className="text-[10px] text-[var(--muted)] truncate">{user.email}</p>
            </div>
          </div>
          {/* Academic year */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--gold-pale)] border border-[rgba(200,168,75,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] flex-shrink-0" />
            <span className="text-[11px] font-semibold text-[var(--gold-dim)]">2025/2026 · Semester 2</span>
          </div>
          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-[var(--muted)] hover:bg-white hover:text-navy rounded-lg transition-all group"
          >
            <LogOut size={13} className="group-hover:text-[var(--err)] transition-colors" />
            Sign out
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
            {/* Notification bell */}
            <button
              className="relative p-[13px] -m-[13px] rounded-lg text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-[9px] right-[9px] w-4 h-4 bg-crimson-light rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {/* Role badge */}
            <span className="hidden sm:inline-flex text-[11px] font-medium text-gold-light border border-[rgba(200,168,75,0.3)] bg-[rgba(200,168,75,0.1)] px-2.5 py-1 rounded-full uppercase tracking-wider">
              {role}
            </span>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A] flex items-center justify-center text-navy-deep font-bold text-xs flex-shrink-0">
              {user.first_name && user.last_name
                ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
                : user.email.slice(0, 2).toUpperCase()}
            </div>
            <span className="hidden md:inline text-sm text-[rgba(255,255,255,0.75)] truncate max-w-[160px]">
              {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.email}
            </span>
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
