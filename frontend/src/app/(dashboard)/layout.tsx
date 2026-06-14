"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, GraduationCap, Users, UserCheck,
  CalendarDays, BarChart2, Star, Trophy, FileText,
  CreditCard, School, Settings, Bell, LogOut, ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useNotifications } from "@/hooks/useApi";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { label: "Overview",   items: [
    { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard" },
  ]},
  { label: "People",     items: [
    { href: "/students",      icon: GraduationCap,   label: "Students" },
    { href: "/teachers",      icon: UserCheck,        label: "Teachers" },
    { href: "/guardians",     icon: Users,            label: "Guardians" },
  ]},
  { label: "Academic",   items: [
    { href: "/attendance",    icon: CalendarDays,     label: "Attendance" },
    { href: "/marks",         icon: BarChart2,        label: "Marks Entry" },
    { href: "/conduct",       icon: Star,             label: "Conduct" },
    { href: "/promotion",     icon: Trophy,           label: "Promotion" },
  ]},
  { label: "Reports",    items: [
    { href: "/report-cards",  icon: FileText,         label: "Report Cards" },
  ]},
  { label: "Finance",    items: [
    { href: "/finance",       icon: CreditCard,       label: "Finance" },
  ]},
  { label: "Admin",      items: [
    { href: "/classes",       icon: School,           label: "Classes & Subjects" },
    { href: "/settings",      icon: Settings,         label: "Settings" },
  ]},
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, role, isAuthenticated, logout } = useAuthStore();
  const { data: notifData } = useNotifications();

  const unreadCount = notifData?.results?.filter((n) => !n.is_read).length ?? 0;

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) return null;

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-[var(--border)] flex flex-col overflow-y-auto">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A] flex items-center justify-center flex-shrink-0">
              <span className="text-navy-deep font-bold text-sm font-serif">SH</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-navy leading-tight">Sacred Heart</p>
              <p className="text-[10px] text-[#8A9ABB] leading-tight">Catholic High School</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-5">
          {NAV.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold tracking-widest text-[#8A9ABB] uppercase px-2 mb-1.5">
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
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150",
                        active
                          ? "bg-navy-pale text-navy font-medium border-l-2 border-[var(--gold)] pl-2"
                          : "text-[#5A6A8A] hover:bg-[var(--surface)] hover:text-navy",
                      )}
                    >
                      <item.icon size={15} className={active ? "text-navy" : "text-[#8A9ABB]"} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)]">
          <div className="bg-navy-pale rounded-lg p-3 text-xs">
            <p className="font-semibold text-navy">2025 / 2026</p>
            <p className="text-[#5A6A8A] mt-0.5">Semester 2 · Active</p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center gap-2 px-2.5 py-2 text-xs text-[#5A6A8A] hover:bg-[var(--surface)] rounded-lg transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-navy-deep border-b border-[rgba(200,168,75,0.2)] flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.5)]">
            <span>Sacred Heart SMS</span>
            <ChevronRight size={12} />
            <span className="text-white capitalize">{pathname.replace("/", "")}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Notification bell */}
            <button className="relative text-[rgba(255,255,255,0.6)] hover:text-white transition-colors">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-crimson-light rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {/* Role badge */}
            <span className="text-[10px] font-medium text-gold-light border border-[rgba(200,168,75,0.3)] bg-[rgba(200,168,75,0.1)] px-2.5 py-1 rounded-full uppercase tracking-wider">
              {role}
            </span>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A] flex items-center justify-center text-navy-deep font-bold text-xs">
              {user.email.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-[rgba(255,255,255,0.75)]">{user.email}</span>
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
