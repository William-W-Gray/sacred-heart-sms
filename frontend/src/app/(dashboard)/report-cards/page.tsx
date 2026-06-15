"use client";
import { useState, useRef } from "react";
import { Printer } from "lucide-react";
import { useStudents, useReportCard } from "@/hooks/useApi";
import { QueryError } from "@/components/shared/QueryError";
import type { ReportCard, ReportCardSubject } from "@/types";

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

function ReportCardView({ data, teacherComment, principalComment }: {
  data: ReportCard;
  teacherComment: string;
  principalComment: string;
}) {
  // Totals row
  const avgs = (data.subjects ?? []).map((s) => s.year_average).filter(Boolean) as number[];
  const overallAvg = avgs.length ? safeAvg(...avgs) : null;
  const promoLabel = data.promotion.decision_display ?? "PENDING DECISION";
  const promoColor = data.promotion.decision ? PROMO_COLOR[data.promotion.decision] : "#888";

  return (
    <div id="rc-print" style={{ background: "#fff", border: "2px solid #1A2A4A", borderRadius: 4, maxWidth: 800, margin: "0 auto", fontFamily: "DM Sans, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#0D1A33", color: "#fff", textAlign: "center", padding: "18px 20px", borderBottom: "3px solid #C8A84B" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.6, marginBottom: 4, textTransform: "uppercase" }}>Republic of Liberia</div>
        <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 22, fontWeight: 600 }}>Sacred Heart Catholic High School</div>
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>&ldquo;Ora et Labora&rdquo; — Faith, Excellence &amp; Service · Monrovia, Liberia</div>
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
          {[
            ["Class Rank", data.ranking.rank ? `🏆 ${data.ranking.rank} of ${data.ranking.class_size}` : "—"],
            ["Year Average", overallAvg?.toFixed(1) ?? "—"],
            ["Final Grade", overallAvg ? (overallAvg >= 95 ? "A — Excellent" : overallAvg >= 85 ? "B — Good" : overallAvg >= 78 ? "C — Average" : overallAvg >= 70 ? "D — Below Avg" : "F — Failing") : "—"],
            ["Days Present", `${data.attendance.present ?? 0} / ${data.attendance.total ?? 0}`],
            ["Days Absent", String(data.attendance.absent ?? 0)],
            ["Attendance", data.attendance.total ? `${Math.round(((data.attendance.present ?? 0) + (data.attendance.late ?? 0)) / data.attendance.total * 100)}%` : "—"],
          ].map(([label, val]) => (
            <div key={label} style={{ borderBottom: "1px solid #ddd", paddingBottom: 4 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, color: "#888", marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 500, fontSize: 12.5, color: "#1A2A4A" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

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

      <hr style={{ border: "none", borderTop: "2px solid #1A2A4A", margin: 0 }} />

      {/* Comments */}
      <div style={{ padding: "12px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[["Class Teacher's Comment", teacherComment], ["Principal's Comment", principalComment]].map(([label, val]) => (
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
        {["Class Teacher's Signature", "Principal's Signature", "School Stamp"].map((label, i) => (
          <div key={label} style={{ borderTop: "1px solid #1A2A4A", paddingTop: 5, textAlign: "center", fontSize: 10, color: "#666" }}>
            {i === 2 ? (
              <><div style={{ width: 52, height: 52, border: "1px solid #DDD", borderRadius: "50%", margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#aaa" }}>SEAL</div>{label}</>
            ) : (
              <>{label}<br /><br /><span style={{ fontSize: 9 }}>Date: _______________</span></>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ background: "#0D1A33", color: "rgba(255,255,255,0.6)", textAlign: "center", padding: 7, fontSize: 10, borderTop: "2px solid #C8A84B" }}>
        Sacred Heart Catholic High School · Monrovia, Liberia · sacredheart@edu.lr
      </div>
    </div>
  );
}

export default function ReportCardPage() {
  const [selStudent,      setStudent]     = useState("");
  const [teacherComment,  setTeacherCmt]  = useState("An exceptional student who consistently demonstrates academic excellence and outstanding character.");
  const [principalComment, setPrincipalCmt] = useState("We are proud of this student's achievements. A true model of Sacred Heart values.");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: students } = useStudents({ page_size: 500 });
  const { data: rcData, isLoading, isError: rcError, refetch: refetchRc } = useReportCard(Number(selStudent), !!selStudent);

  const handlePrint = () => window.print();

  return (
    <>
      <div className="page-header no-print">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Report Card Generator</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">All marks, conduct &amp; attendance pulled live from the database</p>
          </div>
          <button onClick={handlePrint} disabled={!rcData} className="btn-outline flex items-center gap-2 disabled:opacity-50">
            <Printer size={15} /> Print / PDF
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <label className="form-label">Student</label>
            <select value={selStudent} onChange={(e) => setStudent(e.target.value)} className="form-input text-sm">
              <option value="">Select student…</option>
              {students?.results?.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name} — {s.student_id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Teacher Comment</label>
            <input value={teacherComment} onChange={(e) => setTeacherCmt(e.target.value)} className="form-input text-sm" />
          </div>
          <div>
            <label className="form-label">Principal Comment</label>
            <input value={principalComment} onChange={(e) => setPrincipalCmt(e.target.value)} className="form-input text-sm" />
          </div>
        </div>
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
        ) : rcError || !rcData ? (
          <div className="card">
            <QueryError resource="report card data" onRetry={refetchRc} />
          </div>
        ) : (
          <div ref={printRef}>
            <ReportCardView data={rcData} teacherComment={teacherComment} principalComment={principalComment} />
          </div>
        )}
      </div>
    </>
  );
}
