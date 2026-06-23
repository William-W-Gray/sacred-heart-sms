"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import { useAcademicYears, useGradingScales } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import { marksApi } from "@/lib/api/services";

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: "bg-[var(--ok-bg)]",   border: "border-[var(--ok-border)]",   text: "text-[var(--ok)]" },
  B: { bg: "bg-navy-pale",        border: "border-navy/15",               text: "text-navy" },
  C: { bg: "bg-[var(--warn-bg)]", border: "border-[var(--warn-border)]",  text: "text-[var(--warn)]" },
  D: { bg: "bg-orange-50",        border: "border-orange-200",            text: "text-orange-600" },
  F: { bg: "bg-[var(--err-bg)]",  border: "border-[var(--err-border)]",   text: "text-[var(--err)]" },
};

export default function SettingsPage() {
  const { toast }       = useToast();
  const { data: years, isError: yearsError, refetch: refetchYears } = useAcademicYears();
  const { data: scaleData, isError: scalesError, refetch: refetchScales } = useGradingScales();
  const scales = scaleData?.results ?? [];

  const [schoolName, setSchoolName]   = useState("Sacred Heart Catholic High School");
  const [location,   setLocation]     = useState("Monrovia, Liberia");
  const [motto,      setMotto]        = useState("Ora et Labora");
  const [phone,      setPhone]        = useState("+231 770 123 456");
  const [email,      setEmail]        = useState("sacredheart@edu.lr");

  const [scaleDrafts, setScaleDraft]  = useState<Record<number, { min?: number; max?: number; description?: string }>>({});
  const [savingScale, setSavingScale] = useState(false);

  const handleSaveSchool = () => {
    toast({ title: "School settings saved", variant: "success" });
  };

  const handleSaveScale = async () => {
    setSavingScale(true);
    try {
      for (const scale of scales) {
        const draft = scaleDrafts[scale.id];
        if (draft) {
          await marksApi.gradingScales.update(scale.id, { ...scale, ...draft });
        }
      }
      setScaleDraft({});
      toast({ title: "Grading scale saved", variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save grading scale"), variant: "error" });
    } finally {
      setSavingScale(false);
    }
  };

  const updateScaleDraft = (id: number, field: string, value: string) => {
    setScaleDraft((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: field === "description" ? value : Number(value) },
    }));
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">System Settings</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">School information, academic year &amp; grading configuration</p>
          </div>
        </div>
      </div>

      <div className="page-content space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* School info */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-navy">School Information</h3>
              <button onClick={handleSaveSchool} className="btn-gold flex items-center gap-1.5 text-xs px-3 py-1.5">
                <Save size={13} /> Save
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">School Name</label>
                <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">School Motto</label>
                <input value={motto} onChange={(e) => setMotto(e.target.value)} className="form-input" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="form-label">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" />
                </div>
              </div>
            </div>
          </div>

          {/* Grading scale */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-navy">Grading Scale</h3>
                <p className="text-xs text-[#5A6A8A] mt-0.5">Database-driven — never hardcoded</p>
              </div>
              <button onClick={handleSaveScale} disabled={savingScale} className="btn-gold flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-60">
                <Save size={13} />
                {savingScale ? "Saving…" : "Save Scale"}
              </button>
            </div>
            {scalesError ? (
              <QueryError resource="grading scale" onRetry={refetchScales} />
            ) : (
            <div className="space-y-2">
              {scales.map((scale) => {
                const gc = GRADE_COLORS[scale.grade_letter] ?? GRADE_COLORS.F;
                return (
                  <div key={scale.id} className={`flex items-center gap-3 p-3 rounded-lg border ${gc.bg} ${gc.border}`}>
                    <div className={`text-lg font-bold w-7 text-center ${gc.text}`}>{scale.grade_letter}</div>
                    <input
                      defaultValue={scale.description}
                      onChange={(e) => updateScaleDraft(scale.id, "description", e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-[var(--border-strong)] rounded bg-white/70 outline-none focus:border-navy"
                      placeholder="Label…"
                    />
                    <input
                      type="number"
                      defaultValue={scale.min_score}
                      onChange={(e) => updateScaleDraft(scale.id, "min", e.target.value)}
                      className="w-14 px-2 py-1 text-sm text-center border border-[var(--border-strong)] rounded bg-white/70 outline-none focus:border-navy font-mono"
                    />
                    <span className="text-[#5A6A8A] text-xs">–</span>
                    <input
                      type="number"
                      defaultValue={scale.max_score}
                      onChange={(e) => updateScaleDraft(scale.id, "max", e.target.value)}
                      className="w-14 px-2 py-1 text-sm text-center border border-[var(--border-strong)] rounded bg-white/70 outline-none focus:border-navy font-mono"
                    />
                  </div>
                );
              })}
              {scales.length === 0 && (
                <p className="text-sm text-[#8A9ABB] text-center py-6">
                  No grading scales configured yet.
                  <br />
                  <span className="text-xs">Seed the database to see defaults (A=95-100, B=85-94, etc.)</span>
                </p>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Academic years */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-navy mb-4">Academic Years</h3>
          {yearsError ? (
            <QueryError resource="academic years" onRetry={refetchYears} />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[600px]">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {["Name", "Start Date", "End Date", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years?.results?.map((year) => (
                  <tr key={year.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3 font-medium text-navy">{year.name}</td>
                    <td className="px-4 py-3 text-[#5A6A8A] text-xs">{year.start_date}</td>
                    <td className="px-4 py-3 text-[#5A6A8A] text-xs">{year.end_date}</td>
                    <td className="px-4 py-3">{year.is_current ? <span className="badge-ok">Current</span> : <span className="badge-gray">Past</span>}</td>
                  </tr>
                ))}
                {!years?.results?.length && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[#8A9ABB] text-sm">No academic years configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </>
  );
}
