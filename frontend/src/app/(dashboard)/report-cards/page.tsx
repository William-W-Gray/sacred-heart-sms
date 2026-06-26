"use client";
import { useState, useRef, useEffect } from "react";
import { Printer, Lock } from "lucide-react";
import { useStudents, useReportCard, useSchoolProfile, useReportCardTemplate, useGradingScales, useInvoices } from "@/hooks/useApi";
import { useAuthStore } from "@/store/auth.store";
import { QueryError } from "@/components/shared/QueryError";
import type { ReportCard, ReportCardSubject } from "@/types";
import type { SchoolProfile, ReportCardTemplate } from "@/lib/api/services";

// Falls back to the historical Sacred Heart defaults when no profile is saved.
const DEFAULT_SCHOOL = {
  school_name: "Sacred Heart Catholic High School",
  motto:       "Ora et Labora",
  address:     "Monrovia, Liberia",
  email:       "sacredheart@edu.lr",
};

const CONDUCT_CATEGORIES = [
  "Punctuality", "Classroom Conduct", "Homework", "General Neatness",
  "Cooperation With Others", "Respect For Elders", "Respect For School Property",
  "Participation In School Activities", "Leadership Ability", "Emotional Stability",
  "Honesty", "Self Control", "Christian Formation", "Sportsmanship",
];

const GRADE_COLOR: Record<string, string> = {
  A: "#1B6B3A", B: "#0C5F99", C: "#8B5A00", D: "#C87000", F: "#8B1A1A",
};

const PROMO_COLOR: Record<string, string> = {
  promoted: "#1B6B3A", conditioned: "#8B5A00",
  retained: "#8B1A1A", not_returning: "#888",
};

function safeAvg(...vals: (number | null | undefined)[]) {
  const clean = vals.filter((v) => v !== null && v !== undefined) as number[];
  if (!clean.length) return null;
  return parseFloat((clean.reduce((a, b) => a + b, 0) / clean.length).toFixed(2));
}

function SubjectRow({ sub }: { sub: ReportCardSubject }) {
  const gc = sub.grade ? GRADE_COLOR[sub.grade] : "#888";
  return (
    <tr style={{ borderBottom: "1px solid #eee" }}>
      <td style={{ padding: "5px 7px", textAlign: "left", fontSize: 11.5 }}>{sub.subject}</td>
      <td style={{ padding: "5px 7px", textAlign: "center", fontSize: 11 }}>{sub.s1_test ?? "—"}</td>
      <td style={{ padding: "5px 7px", textAlign: "center", fontSize: 11 }}>{sub.s1_exam ?? "—"}</td>
      <td style={{ padding: "5px 7px", textAlign: "center", fontSize: 11, fontWeight: 600, background: "#f0f4f8" }}>{sub.s1_average?.toFixed(1) ?? "—"}</td>
      <td style={{ padding: "5px 7px", textAlign: "center", fontSize: 11 }}>{sub.s2_test ?? "—"}</td>
      <td style={{ padding: "5px 7px", textAlign: "center", fontSize: 11 }}>{sub.s2_exam ?? "—"}</td>
      <td style={{ padding: "5px 7px", textAlign: "center", fontSize: 11, fontWeight: 600, background: "#fffbee" }}>{sub.s2_average?.toFixed(1) ?? "—"}</td>
      <td style={{ padding: "5px 7px", textAlign: "center", fontSize: 12, fontWeight: 700 }}>{sub.year_average?.toFixed(1) ?? "—"}</td>
      <td style={{ padding: "5px 7px", textAlign: "center", fontSize: 12, fontWeight: 700, color: gc }}>{sub.grade ?? "—"}</td>
    </tr>
  );
}

// Sensible defaults when no template row has been saved yet — everything on.
const DEFAULT_TPL = {
  header_line: "Republic of Liberia",
  show_logo: true, show_motto: true, show_conduct: true, show_attendance: true,
  show_finance_balance: false, show_grading_scale: true,
  teacher_comment_label: "Class Teacher's Comment",
  principal_comment_label: "Principal's Comment",
  principal_signature: "", footer_text: "",
};

function ReportCardView({ data, teacherComment, principalComment, school, tpl, gradingScale, financeBalance }: {
  data: ReportCard;
  teacherComment: string;
  principalComment: string;
  school?: SchoolProfile | null;
  tpl?: ReportCardTemplate | null;
  gradingScale?: { grade_letter: string; min_score: number; max_score: number; description: string }[];
  financeBalance?: number | null;
}) {
  const t = tpl ?? DEFAULT_TPL;
  const schoolName = school?.school_name || DEFAULT_SCHOOL.school_name;
  const schoolMotto = school?.motto || DEFAULT_SCHOOL.motto;
  const schoolAddr = school?.address || DEFAULT_SCHOOL.address;
  const schoolEmail = school?.email || DEFAULT_SCHOOL.email;
  // Totals row
  const avgs = (data.subjects ?? []).map((s) => s.year_average).filter(Boolean) as number[];
  const overallAvg = avgs.length ? safeAvg(...avgs) : null;
  const promoLabel = data.promotion.decision_display ?? "PENDING DECISION";
  const promoColor = data.promotion.decision ? PROMO_COLOR[data.promotion.decision] : "#888";

  return (
    <div id="rc-print" style={{ background: "#fff", border: "2px solid #1A2A4A", borderRadius: 4, maxWidth: 800, margin: "0 auto", fontFamily: "DM Sans, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#0D1A33", color: "#fff", textAlign: "center", padding: "18px 20px", borderBottom: "3px solid #C8A84B" }}>
        {t.header_line && <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.6, marginBottom: 4, textTransform: "uppercase" }}>{t.header_line}</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {t.show_logo && school?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logo} alt="" style={{ height: 38, width: 38, objectFit: "contain" }} />
          )}
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 22, fontWeight: 600 }}>{schoolName}</div>
        </div>
        {t.show_motto && (
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>&ldquo;{schoolMotto}&rdquo; — Faith, Excellence &amp; Service · {schoolAddr}</div>
        )}
        <div style={{ fontSize: 13, fontWeight: 500, color: "#E8C96A", marginTop: 8 }}>OFFICIAL STUDENT REPORT CARD — ACADEMIC YEAR {data.academic_year}</div>
      </div>

      {/* Student info */}
      <div style={{ padding: "14px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, fontSize: 12 }}>
          {[
            ["Student Name", data.student.full_name],
            ["Student ID", data.student.student_id],
            ["Class", data.student.class ?? "—"],
            ["Date of Birth", data.student.date_of_birth ?? "—"],
            ["Gender", data.student.gender],
            ["Academic Year", data.academic_year],
          ].map(([label, val]) => (
            <div key={label} style={{ borderBottom: "1px solid #ddd", paddingBottom: 4 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, color: "#888", marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 500, fontSize: 12.5, color: "#1A2A4A" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "2px solid #1A2A4A", margin: 0 }} />

      {/* Subjects table */}
      <div style={{ padding: "12px 18px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ background: "#0D1A33", color: "#fff", padding: "6px 7px", textAlign: "left", width: "22%" }}>Subject</th>
              <th colSpan={3} style={{ background: "rgba(26,42,74,0.85)", color: "#fff", padding: "6px 7px", textAlign: "center" }}>SEMESTER 1</th>
              <th colSpan={3} style={{ background: "rgba(200,168,75,0.6)", color: "#1A2A4A", padding: "6px 7px", textAlign: "center" }}>SEMESTER 2</th>
              <th style={{ background: "#0D1A33", color: "#fff", padding: "6px 7px", textAlign: "center" }}>Year Avg</th>
              <th style={{ background: "#0D1A33", color: "#fff", padding: "6px 7px", textAlign: "center" }}>Grade</th>
            </tr>
            <tr style={{ fontSize: 9, background: "rgba(26,42,74,0.65)", color: "#fff" }}>
              <th style={{ padding: "5px 7px", textAlign: "left" }}>Name</th>
              <th style={{ padding: "5px 7px", textAlign: "center" }}>Test</th>
              <th style={{ padding: "5px 7px", textAlign: "center" }}>Exam</th>
              <th style={{ padding: "5px 7px", textAlign: "center" }}>Avg</th>
              <th style={{ padding: "5px 7px", textAlign: "center", background: "rgba(200,168,75,0.4)", color: "#1A2A4A" }}>Test</th>
              <th style={{ padding: "5px 7px", textAlign: "center", background: "rgba(200,168,75,0.4)", color: "#1A2A4A" }}>Exam</th>
              <th style={{ padding: "5px 7px", textAlign: "center", background: "rgba(200,168,75,0.4)", color: "#1A2A4A" }}>Avg</th>
              <th style={{ padding: "5px 7px" }} /><th style={{ padding: "5px 7px" }} />
            </tr>
          </thead>
          <tbody>
            {data.subjects?.length
              ? data.subjects?.map((sub) => <SubjectRow key={sub.subject} sub={sub} />)
              : <tr><td colSpan={9} style={{ textAlign: "center", padding: 14, color: "#aaa", fontSize: 12 }}>No marks recorded yet</td></tr>
            }
            {/* Average row */}
            <tr style={{ background: "#FDF6E3", borderTop: "2px solid #C8A84B", fontWeight: 700 }}>
              <td style={{ padding: "6px 7px", textAlign: "left", fontSize: 11.5 }}>AVERAGE</td>
              <td colSpan={2} />
              <td style={{ textAlign: "center", fontSize: 12 }}>—</td>
              <td colSpan={2} />
              <td style={{ textAlign: "center", fontSize: 12 }}>—</td>
              <td style={{ textAlign: "center", fontSize: 13, fontWeight: 700 }}>{overallAvg?.toFixed(1) ?? "—"}</td>
              <td style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: overallAvg ? GRADE_COLOR["A"] : "#888" }}>
                {overallAvg ? (overallAvg >= 95 ? "A" : overallAvg >= 85 ? "B" : overallAvg >= 78 ? "C" : overallAvg >= 70 ? "D" : "F") : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{ padding: "12px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, fontSize: 12 }}>
          {([
            ["Class Rank", data.ranking.rank ? `🏆 ${data.ranking.rank} of ${data.ranking.class_size}` : "—"],
            ["Year Average", overallAvg?.toFixed(1) ?? "—"],
            ["Final Grade", overallAvg ? (overallAvg >= 95 ? "A — Excellent" : overallAvg >= 85 ? "B — Good" : overallAvg >= 78 ? "C — Average" : overallAvg >= 70 ? "D — Below Avg" : "F — Failing") : "—"],
            ...(t.show_attendance ? [
              ["Days Present", `${data.attendance.present ?? 0} / ${data.attendance.total ?? 0}`],
              ["Days Absent", String(data.attendance.absent ?? 0)],
              ["Attendance", data.attendance.total ? `${Math.round(((data.attendance.present ?? 0) + (data.attendance.late ?? 0)) / data.attendance.total * 100)}%` : "—"],
            ] : []),
            ...(t.show_finance_balance ? [
              ["Fees Balance", financeBalance != null ? `$${financeBalance.toFixed(2)}` : "—"],
            ] : []),
          ] as [string, string][]).map(([label, val]) => (
            <div key={label} style={{ borderBottom: "1px solid #ddd", paddingBottom: 4 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, color: "#888", marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 500, fontSize: 12.5, color: "#1A2A4A" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Grading scale legend */}
      {t.show_grading_scale && gradingScale && gradingScale.length > 0 && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: 0 }} />
          <div style={{ padding: "10px 18px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, color: "#1A2A4A" }}>Grading Scale</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 10 }}>
              {gradingScale.map((g) => (
                <span key={g.grade_letter} style={{ border: "1px solid #ddd", borderRadius: 3, padding: "2px 7px", color: "#1A2A4A" }}>
                  <b>{g.grade_letter}</b> {g.min_score}–{g.max_score} · {g.description}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {t.show_conduct && (
      <>
      <hr style={{ border: "none", borderTop: "2px solid #1A2A4A", margin: 0 }} />

      {/* Conduct */}
      <div style={{ padding: "12px 18px" }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7, color: "#1A2A4A" }}>
          Conduct Evaluation (1 = Lowest · 6 = Highest)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {CONDUCT_CATEGORIES.map((cat, i) => {
            const rating = data.conduct.find((c) => c.category === cat)?.rating ?? 0;
            return (
              <div
                key={cat}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "5px 8px", borderBottom: "1px solid #eee", fontSize: 11,
                  borderRight: i % 2 === 0 ? "1px solid #ddd" : "none",
                }}
              >
                <span>{cat}</span>
                <div style={{ display: "flex", gap: 3 }}>
                  {[1,2,3,4,5,6].map((n) => (
                    <div key={n} style={{ width: 11, height: 11, borderRadius: "50%", border: "1px solid #1A2A4A", background: n <= rating ? "#1A2A4A" : "transparent" }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}

      <hr style={{ border: "none", borderTop: "2px solid #1A2A4A", margin: 0 }} />

      {/* Comments */}
      <div style={{ padding: "12px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[[t.teacher_comment_label, teacherComment], [t.principal_comment_label, principalComment]].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5, color: "#1A2A4A" }}>{label}</div>
              <div style={{ border: "1px solid #ccc", borderRadius: 3, padding: 7, minHeight: 44, fontSize: 11.5, color: "#333", fontStyle: "italic" }}>{val || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Promotion */}
      <div style={{ textAlign: "center", padding: "9px 18px", background: "#F8F8F5", borderTop: "1px solid #DDD", borderBottom: "1px solid #DDD" }}>
        <span style={{ fontSize: 11, fontWeight: 700, background: promoColor, color: "#fff", padding: "5px 16px", borderRadius: 20 }}>
          {promoLabel.toUpperCase()}
        </span>
      </div>

      {/* Signatures */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: "14px 18px" }}>
        {["Class Teacher's Signature", t.principal_signature || "Principal's Signature", "School Stamp"].map((label, i) => (
          <div key={i} style={{ borderTop: "1px solid #1A2A4A", paddingTop: 5, textAlign: "center", fontSize: 10, color: "#666" }}>
            {i === 2 ? (
              <><div style={{ width: 52, height: 52, border: "1px solid #DDD", borderRadius: "50%", margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#aaa" }}>SEAL</div>School Stamp</>
            ) : (
              <>{label}<br /><br /><span style={{ fontSize: 9 }}>Date: _______________</span></>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ background: "#0D1A33", color: "rgba(255,255,255,0.6)", textAlign: "center", padding: 7, fontSize: 10, borderTop: "2px solid #C8A84B" }}>
        {t.footer_text || `${schoolName} · ${schoolAddr}${schoolEmail ? ` · ${schoolEmail}` : ""}`}
      </div>
    </div>
  );
}

export default function ReportCardPage() {
  const role = useAuthStore((s) => s.role);
  // Only admins get the full "generator" (editable comments + arbitrary student picker).
  // Teachers view read-only cards for their assigned students; students/guardians view their own.
  const canEdit = role === "admin";
  const showSelector = role !== "student";

  const [selStudent,      setStudent]     = useState("");
  const [teacherComment,  setTeacherCmt]  = useState("An exceptional student who consistently demonstrates academic excellence and outstanding character.");
  const [principalComment, setPrincipalCmt] = useState("We are proud of this student's achievements. A true model of Sacred Heart values.");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: students } = useStudents({ page_size: 500 });

  // Students (and guardians of a single child) shouldn't have to pick — auto-load their own card.
  useEffect(() => {
    if (!selStudent && (role === "student" || role === "guardian")) {
      const first = students?.results?.[0];
      if (first) setStudent(String(first.id));
    }
  }, [students, role, selStudent]);
  const { data: school } = useSchoolProfile();
  const { data: tpl } = useReportCardTemplate();
  const { data: scaleData } = useGradingScales();
  const { data: rcData, isLoading, isError: rcError, error: rcErrObj, refetch: refetchRc } = useReportCard(Number(selStudent), !!selStudent);
  // Finance hold surfaces as a 403 with a finance message — show that, not a generic error.
  const rcStatus = (rcErrObj as { response?: { status?: number; data?: { detail?: string } } } | null)?.response;
  const financeHold = rcStatus?.status === 403;
  const holdMessage = rcStatus?.data?.detail || "This report card is on hold due to an outstanding balance. Please contact the finance office.";

  // Fees balance — only needed when the template shows it; fetch lazily.
  const { data: invoiceData } = useInvoices(
    { student: Number(selStudent) },
    { enabled: !!selStudent && !!tpl?.show_finance_balance },
  );
  const financeBalance = invoiceData?.results
    ? invoiceData.results.reduce((sum, inv) => sum + Number(inv.balance ?? 0), 0)
    : null;

  const handlePrint = () => window.print();

  return (
    <>
      <div className="page-header no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">{canEdit ? "Report Card Generator" : "Report Card"}</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">All marks, conduct &amp; attendance pulled live from the database</p>
          </div>
          <button onClick={handlePrint} disabled={!rcData} className="btn-outline flex items-center gap-2 disabled:opacity-50">
            <Printer size={15} /> Print / PDF
          </button>
        </div>

        {(showSelector || canEdit) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {showSelector && (
              <div>
                <label className="form-label">{role === "guardian" ? "Child" : "Student"}</label>
                <select value={selStudent} onChange={(e) => setStudent(e.target.value)} className="form-input text-sm">
                  <option value="">Select student…</option>
                  {students?.results?.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name} — {s.student_id}</option>
                  ))}
                </select>
              </div>
            )}
            {canEdit && (
              <>
                <div>
                  <label className="form-label">Teacher Comment</label>
                  <input value={teacherComment} onChange={(e) => setTeacherCmt(e.target.value)} className="form-input text-sm" />
                </div>
                <div>
                  <label className="form-label">Principal Comment</label>
                  <input value={principalComment} onChange={(e) => setPrincipalCmt(e.target.value)} className="form-input text-sm" />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="page-content">
        {!selStudent ? (
          <div className="card flex flex-col items-center justify-center h-64 text-[#8A9ABB]">
            <div className="text-4xl mb-3">📄</div>
            <p className="font-medium">Select a student to generate their report card</p>
          </div>
        ) : isLoading ? (
          <div className="card flex items-center justify-center h-64 text-[#5A6A8A] text-sm">
            Loading report card data…
          </div>
        ) : financeHold ? (
          <div className="card flex flex-col items-center justify-center h-64 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-[var(--err-bg)] flex items-center justify-center mb-3">
              <Lock size={22} className="text-[var(--err)]" />
            </div>
            <p className="font-semibold text-[var(--err)]">Report card on hold</p>
            <p className="text-sm text-[#5A6A8A] mt-1 max-w-sm">{holdMessage}</p>
          </div>
        ) : rcError || !rcData ? (
          <div className="card">
            <QueryError resource="report card data" onRetry={refetchRc} />
          </div>
        ) : (
          <div ref={printRef}>
            <ReportCardView
              data={rcData}
              teacherComment={teacherComment}
              principalComment={principalComment}
              school={school}
              tpl={tpl}
              gradingScale={scaleData?.results}
              financeBalance={financeBalance}
            />
          </div>
        )}
      </div>
    </>
  );
}
