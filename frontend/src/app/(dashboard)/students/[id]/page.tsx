"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Pencil, FileText, Phone, Mail, Users, Star, CalendarDays, Lock,
} from "lucide-react";
import { useStudent, useReportCard, useSetFinanceHold } from "@/hooks/useApi";
import { useAuthStore } from "@/store/auth.store";
import { StudentModal } from "@/components/forms/StudentModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GradeCell, GradeBadge } from "@/components/shared/GradeCell";
import { QueryError } from "@/components/shared/QueryError";
import { useToast } from "@/components/ui/toaster";
import { getApiErrorMessage } from "@/lib/utils/errors";

function pct(part: number | null, total: number | null): string {
  if (!total || part === null) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { role } = useAuthStore();
  const canEdit = role === "admin";
  const isFinance = role === "finance_officer";
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const setHold = useSetFinanceHold(id);

  const placeHold = async () => {
    try { await setHold.mutateAsync({ hold: true, reason: holdReason }); toast({ title: "Academic hold placed", variant: "success" }); setHoldReason(""); }
    catch (err) { toast({ title: getApiErrorMessage(err, "Failed to place hold"), variant: "error" }); }
  };
  const liftHold = async () => {
    try { await setHold.mutateAsync({ hold: false }); toast({ title: "Academic hold lifted", variant: "success" }); }
    catch (err) { toast({ title: getApiErrorMessage(err, "Failed to lift hold"), variant: "error" }); }
  };

  const { data: student, isLoading, isError, refetch } = useStudent(id);
  // Report card carries the live academic summary (marks, attendance, rank).
  // It may legitimately be empty for a freshly-enrolled student, so its own
  // error/empty state is handled independently of the profile load.
  const { data: rc } = useReportCard(id, !!student);

  if (isLoading) {
    return (
      <div className="page-content">
        <div className="card flex items-center justify-center h-64 text-[#5A6A8A] text-sm">
          Loading student profile…
        </div>
      </div>
    );
  }

  // 404 here also covers RBAC: the backend scopes the queryset, so a teacher/
  // guardian/student requesting an unauthorized record gets "not found".
  if (isError || !student) {
    return (
      <div className="page-content">
        <div className="card p-8">
          <QueryError resource="student profile" onRetry={refetch} />
          <div className="mt-4 text-center">
            <button onClick={() => router.push("/students")} className="btn-outline text-sm">
              ← Back to Students
            </button>
          </div>
        </div>
      </div>
    );
  }

  const initials = `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/students"
              className="p-2 rounded-lg hover:bg-[var(--surface)] text-[#5A6A8A] hover:text-navy transition-colors"
              title="Back to Students"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-navy font-serif">{student.full_name}</h1>
              <p className="text-sm text-[#5A6A8A] mt-0.5 font-mono">{student.student_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/report-cards?student=${student.id}`} className="btn-outline flex items-center gap-2 text-sm">
              <FileText size={15} /> Report Card
            </Link>
            {canEdit && (
              <button onClick={() => setEditOpen(true)} className="btn-gold flex items-center gap-2 text-sm">
                <Pencil size={15} /> Edit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-content space-y-5">
        {/* Finance hold — status to all staff; toggle for finance officers only */}
        {(student.finance_hold || isFinance) && (
          <div className={`card p-5 ${student.finance_hold ? "border-[var(--err-border)] bg-[var(--err-bg)]" : ""}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Lock size={18} className={`mt-0.5 flex-shrink-0 ${student.finance_hold ? "text-[var(--err)]" : "text-[var(--muted)]"}`} />
                <div>
                  <p className={`text-sm font-semibold ${student.finance_hold ? "text-[var(--err)]" : "text-navy"}`}>
                    {student.finance_hold ? "Academic hold active" : "No academic hold"}
                  </p>
                  <p className="text-xs text-[#5A6A8A] mt-0.5">
                    {student.finance_hold
                      ? `${student.finance_hold_reason || "Outstanding balance"}${student.finance_hold_by_name ? ` · placed by ${student.finance_hold_by_name}` : ""}. Report cards & results are blocked for the student and their guardians.`
                      : "Report cards & results are visible to the student and guardians."}
                  </p>
                </div>
              </div>
              {isFinance && (
                student.finance_hold ? (
                  <button onClick={liftHold} disabled={setHold.isPending} className="btn-outline text-sm whitespace-nowrap disabled:opacity-60">
                    {setHold.isPending ? "Working…" : "Lift hold"}
                  </button>
                ) : (
                  <div className="flex gap-2 items-center flex-shrink-0">
                    <input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Reason (optional)" className="form-input text-sm w-44" maxLength={255} />
                    <button onClick={placeHold} disabled={setHold.isPending} className="btn-gold text-sm whitespace-nowrap disabled:opacity-60">
                      {setHold.isPending ? "Working…" : "Place hold"}
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Identity card */}
          <div className="card p-6 lg:col-span-1">
            <div className="flex flex-col items-center text-center">
              {student.photo ? (
                <Image
                  src={student.photo}
                  alt={student.full_name}
                  width={112}
                  height={112}
                  className="w-28 h-28 rounded-full object-cover border-2 border-[var(--border)]"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-navy-pale flex items-center justify-center text-navy font-semibold text-3xl border-2 border-[var(--border)]">
                  {initials}
                </div>
              )}
              <h2 className="text-lg font-semibold text-navy mt-3">{student.full_name}</h2>
              <div className="mt-1.5"><StatusBadge status={student.status} /></div>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <Row label="Class">
                {student.class_name ? <span className="badge-navy">{student.class_name}</span> : "—"}
              </Row>
              <Row label="Gender">{student.gender === "F" ? "Female" : "Male"}</Row>
              <Row label="Date of Birth">{student.date_of_birth ?? "—"}</Row>
              <Row label="Enrolled">
                {student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString() : "—"}
              </Row>
            </dl>
          </div>

          {/* Academic summary */}
          <div className="card p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold text-navy mb-4 flex items-center gap-2">
              <Star size={15} className="text-gold" /> Academic Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Year Average" >
                <GradeCell value={rc?.ranking?.year_average ?? null} />
              </Stat>
              <Stat label="Grade">
                <GradeBadge letter={rc?.subjects?.[0]?.grade ?? null} />
              </Stat>
              <Stat label="Class Rank">
                {rc?.ranking?.rank != null
                  ? <span className="font-semibold text-navy">{rc.ranking.rank}<span className="text-[#8A9ABB] text-xs"> / {rc.ranking.class_size ?? "—"}</span></span>
                  : "—"}
              </Stat>
              <Stat label="Attendance">
                <span className="font-semibold text-navy">{pct(rc?.attendance?.present ?? null, rc?.attendance?.total ?? null)}</span>
              </Stat>
            </div>

            {/* Attendance breakdown */}
            <div className="mt-5 flex items-center gap-2 text-xs text-[#5A6A8A]">
              <CalendarDays size={14} />
              <span>Present {rc?.attendance?.present ?? "—"}</span>·
              <span>Absent {rc?.attendance?.absent ?? "—"}</span>·
              <span>Late {rc?.attendance?.late ?? "—"}</span>·
              <span>Total {rc?.attendance?.total ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* Subjects / marks */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-navy mb-4">Subjects &amp; Marks</h3>
          {!rc?.subjects?.length ? (
            <p className="text-sm text-[#8A9ABB] text-center py-6">No marks recorded yet for this student.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[560px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Subject", "Sem 1 Avg", "Sem 2 Avg", "Year Avg", "Grade"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rc.subjects.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-3 font-medium text-navy">{s.subject}</td>
                      <td className="px-4 py-3"><GradeCell value={s.s1_average} /></td>
                      <td className="px-4 py-3"><GradeCell value={s.s2_average} /></td>
                      <td className="px-4 py-3"><GradeCell value={s.year_average} /></td>
                      <td className="px-4 py-3"><GradeBadge letter={s.grade} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Guardians */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-navy mb-4 flex items-center gap-2">
            <Users size={15} /> Guardians
          </h3>
          {!student.guardians?.length ? (
            <p className="text-sm text-[#8A9ABB] text-center py-6">No guardians linked to this student.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {student.guardians.map((g) => (
                <div key={g.id} className="rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-navy">{g.name}</p>
                    {g.is_primary && <span className="badge-ok text-[10px]">Primary</span>}
                  </div>
                  <p className="text-xs text-[#5A6A8A] capitalize mt-0.5">{g.relationship || "Guardian"}</p>
                  <div className="mt-3 space-y-1.5 text-xs text-[#5A6A8A]">
                    {g.phone && (
                      <a href={`tel:${g.phone}`} className="flex items-center gap-2 hover:text-navy">
                        <Phone size={13} /> {g.phone}
                      </a>
                    )}
                    {g.email && (
                      <a href={`mailto:${g.email}`} className="flex items-center gap-2 hover:text-navy break-all">
                        <Mail size={13} /> {g.email}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <StudentModal open={editOpen} student={student} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#8A9ABB]">{label}</dt>
      <dd className="text-navy font-medium text-right">{children}</dd>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
      <p className="text-[10px] font-semibold text-[#8A9ABB] uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex items-center justify-center">{children}</div>
    </div>
  );
}
