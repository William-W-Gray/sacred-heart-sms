"use client";
import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { Save, Upload } from "lucide-react";
import Image from "next/image";
import { useAcademicYears, useGradingScales, useSchoolProfile, useUpdateSchoolProfile } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import { marksApi } from "@/lib/api/services";
import { GradingTemplatesSection } from "@/components/settings/GradingTemplatesSection";
import { ReportCardTemplateSection } from "@/components/settings/ReportCardTemplateSection";

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

  const { data: school, isError: schoolError, isLoading: schoolLoading, refetch: refetchSchool } = useSchoolProfile();
  const updateSchool = useUpdateSchoolProfile();

  // Editable copy of the persisted school profile. Re-seeded whenever the
  // server record loads/changes so the form reflects saved values on refresh.
  const [form, setForm] = useState({
    school_name: "", address: "", motto: "", phone: "", email: "", principal_name: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (school) {
      setForm({
        school_name:    school.school_name    ?? "",
        address:        school.address        ?? "",
        motto:          school.motto          ?? "",
        phone:          school.phone          ?? "",
        email:          school.email          ?? "",
        principal_name: school.principal_name ?? "",
      });
    }
  }, [school]);

  const setField = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const [scaleDrafts, setScaleDraft]  = useState<Record<number, { min?: number; max?: number; description?: string }>>({});
  const [savingScale, setSavingScale] = useState(false);

  const handleLogoPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Logo must be an image file", variant: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Logo must be under 5MB", variant: "error" });
      return;
    }
    setLogoFile(file);
  };

  const handleSaveSchool = async () => {
    if (!form.school_name.trim()) {
      toast({ title: "School name is required", variant: "error" });
      return;
    }
    // Critical change — the school name shows on every report card & dashboard.
    if (school && form.school_name.trim() !== school.school_name) {
      const ok = window.confirm(
        `Change the school name from "${school.school_name}" to "${form.school_name.trim()}"?\n\n` +
        "This name appears on report cards, dashboards and printed documents.",
      );
      if (!ok) return;
    }
    try {
      let payload: FormData | Record<string, string>;
      if (logoFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        fd.append("logo", logoFile);
        payload = fd;
      } else {
        payload = { ...form };
      }
      await updateSchool.mutateAsync(payload);
      setLogoFile(null);
      toast({ title: "School profile saved", variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save school profile"), variant: "error" });
    }
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
              <h3 className="text-sm font-semibold text-navy">School Profile</h3>
              <button
                onClick={handleSaveSchool}
                disabled={updateSchool.isPending || schoolLoading}
                className="btn-gold flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-60"
              >
                <Save size={13} /> {updateSchool.isPending ? "Saving…" : "Save"}
              </button>
            </div>

            {schoolError ? (
              <QueryError resource="school profile" onRetry={refetchSchool} />
            ) : schoolLoading ? (
              <p className="text-sm text-[#8A9ABB] py-6 text-center">Loading school profile…</p>
            ) : (
            <div className="space-y-4">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoFile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={URL.createObjectURL(logoFile)} alt="logo preview" className="h-full w-full object-contain" />
                  ) : school?.logo ? (
                    <Image src={school.logo} alt="school logo" width={64} height={64} className="object-contain" />
                  ) : (
                    <span className="text-[10px] text-[#8A9ABB] text-center px-1">No logo</span>
                  )}
                </div>
                <div>
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoPick} className="hidden" />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="btn-outline flex items-center gap-1.5 text-xs px-3 py-1.5"
                  >
                    <Upload size={13} /> {logoFile ? "Change logo" : "Upload logo"}
                  </button>
                  <p className="text-[11px] text-[#8A9ABB] mt-1">PNG/JPG, up to 5MB</p>
                </div>
              </div>
              <div>
                <label className="form-label">School Name</label>
                <input value={form.school_name} onChange={(e) => setField("school_name", e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Address</label>
                <input value={form.address} onChange={(e) => setField("address", e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">School Motto</label>
                <input value={form.motto} onChange={(e) => setField("motto", e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Principal Name</label>
                <input value={form.principal_name} onChange={(e) => setField("principal_name", e.target.value)} className="form-input" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="form-label">Phone</label>
                  <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input value={form.email} onChange={(e) => setField("email", e.target.value)} className="form-input" />
                </div>
              </div>
            </div>
            )}
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

        {/* Grading templates (admin-defined assessment setup) */}
        <GradingTemplatesSection />

        {/* Report card template editor */}
        <ReportCardTemplateSection />
      </div>
    </>
  );
}
