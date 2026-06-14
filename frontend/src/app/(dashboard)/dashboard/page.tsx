"use client";
import { GraduationCap, Users, TrendingUp, AlertCircle, Plus, BarChart2, FileText, CreditCard } from "lucide-react";
import { useStudents, useTeachers, useInvoices, useAcademicYears } from "@/hooks/useApi";
import { useAuthStore } from "@/store/auth.store";
import Link from "next/link";

function StatCard({
  label, value, change, changeType, icon: Icon, accent,
}: {
  label: string; value: string; change?: string;
  changeType?: "up" | "down" | "neutral"; icon: React.ElementType; accent: string;
}) {
  return (
    <div className={`card relative overflow-hidden pt-1`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent}`} />
      <div className="p-5">
        <p className="text-[11px] font-medium text-[#5A6A8A] uppercase tracking-wider mb-2">{label}</p>
        <p className="text-3xl font-semibold text-navy font-mono">{value}</p>
        {change && (
          <p className={`text-xs mt-2 ${changeType === "up" ? "text-[var(--ok)]" : changeType === "down" ? "text-[var(--err)]" : "text-[#5A6A8A]"}`}>
            {change}
          </p>
        )}
        <Icon size={32} className="absolute right-5 top-1/2 -translate-y-1/2 text-navy opacity-[0.06]" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: students }  = useStudents({ page_size: 1000 });
  const { data: teachers }  = useTeachers({ page_size: 1000 });
  const { data: invoices }  = useInvoices({ page_size: 1000 });
  const { data: years }     = useAcademicYears();

  const totalStudents = students?.count ?? 0;
  const totalTeachers = teachers?.count ?? 0;

  const allInvoices   = invoices?.results ?? [];
  const totalInvoiced = allInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid     = allInvoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const outstanding   = totalInvoiced - totalPaid;
  const collRate      = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
  const overdueCount  = allInvoices.filter((i) => i.status === "overdue").length;

  const currentYear   = years?.results?.find((y) => y.is_current);

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Dashboard</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">
              Good morning — here&apos;s your school at a glance.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/students" className="btn-outline flex items-center gap-2">
              <GraduationCap size={15} /> All Students
            </Link>
            <Link href="/students" className="btn-gold flex items-center gap-2">
              <Plus size={15} /> Enrol Student
            </Link>
          </div>
        </div>
      </div>

      <div className="page-content space-y-6">
        {/* Hero */}
        <div className="rounded-card p-8 bg-gradient-to-br from-navy-deep via-navy to-[#243A6A] relative overflow-hidden shadow-lg">
          <div className="absolute top-[-60px] right-[-60px] w-48 h-48 rounded-full bg-radial-gradient opacity-20" />
          <h2 className="text-white text-2xl font-serif font-semibold">Sacred Heart Catholic High School</h2>
          <p className="text-[rgba(255,255,255,0.6)] text-sm mt-1">"Ora et Labora" · Faith, Excellence &amp; Service · Monrovia, Liberia</p>
          <div className="flex gap-3 mt-5 flex-wrap">
            {[
              { label: currentYear?.name ?? "2025/2026", dot: true },
              { label: "Semester 2 Active" },
              { label: `${totalStudents} Students` },
              { label: `${totalTeachers} Teachers` },
            ].map((chip) => (
              <div key={chip.label} className="flex items-center gap-1.5 text-xs text-[rgba(255,255,255,0.8)] bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.15)] px-3 py-1.5 rounded-full">
                {chip.dot && <span className="w-1.5 h-1.5 rounded-full bg-[#E8C96A]" />}
                {chip.label}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Students" value={String(totalStudents)} change="Active enrolments" changeType="neutral" icon={GraduationCap} accent="bg-gradient-to-r from-[#C8A84B] to-[#E8C96A]" />
          <StatCard label="Teaching Staff"  value={String(totalTeachers)} change="Across all departments" changeType="neutral" icon={Users} accent="bg-gradient-to-r from-navy to-navy-light" />
          <StatCard label="Fee Collection"  value={`${collRate}%`} change={`L$${totalPaid.toLocaleString()} collected`} changeType="up" icon={TrendingUp} accent="bg-gradient-to-r from-[#1B6B3A] to-[#2A9D5C]" />
          <StatCard label="Outstanding Fees" value={`L$${outstanding.toLocaleString()}`} change={`${overdueCount} overdue invoices`} changeType={overdueCount > 0 ? "down" : "neutral"} icon={AlertCircle} accent="bg-gradient-to-r from-crimson to-crimson-light" />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5 col-span-2">
            <h3 className="text-sm font-semibold text-navy mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/students",     icon: GraduationCap, label: "Enrol New Student",   desc: "Add a student to the registry" },
                { href: "/marks",        icon: BarChart2,      label: "Enter Marks",          desc: "Record test & exam scores" },
                { href: "/attendance",   icon: BarChart2,      label: "Record Attendance",    desc: "Per-subject daily attendance" },
                { href: "/report-cards", icon: FileText,       label: "Generate Report Card", desc: "Full PDF-ready report card" },
                { href: "/finance",      icon: CreditCard,     label: "Create Invoice",       desc: "Tuition fee billing" },
                { href: "/conduct",      icon: BarChart2,      label: "Conduct Ratings",      desc: "14-category conduct evaluation" },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] hover:border-[var(--border-strong)] transition-all group">
                  <div className="w-8 h-8 rounded-md bg-navy-pale flex items-center justify-center flex-shrink-0 group-hover:bg-navy group-hover:text-white transition-colors">
                    <a.icon size={15} className="text-navy group-hover:text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy">{a.label}</p>
                    <p className="text-xs text-[#5A6A8A] mt-0.5">{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Finance summary */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy">Finance</h3>
              <Link href="/finance" className="text-xs text-[#5A6A8A] hover:text-navy transition-colors">View all →</Link>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#5A6A8A]">Collected</span>
                  <span className="font-semibold text-[var(--ok)] font-mono">L${totalPaid.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-[var(--surface2)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--ok)] rounded-full transition-all" style={{ width: `${collRate}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#5A6A8A]">Outstanding</span>
                <span className="font-semibold text-[var(--err)] font-mono">L${outstanding.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#5A6A8A]">Collection Rate</span>
                <span className="font-semibold text-navy">{collRate}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#5A6A8A]">Total Invoices</span>
                <span className="font-semibold text-navy">{allInvoices.length}</span>
              </div>
            </div>
            <Link href="/finance" className="btn-gold w-full text-center text-xs py-2 mt-auto">
              Manage Finance →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
