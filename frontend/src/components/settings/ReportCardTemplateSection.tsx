"use client";
import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { useReportCardTemplate, useUpdateReportCardTemplate, useSchoolProfile } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { ReportCardTemplate } from "@/lib/api/services";

type FormState = Omit<ReportCardTemplate, "id" | "updated_at" | "updated_by" | "updated_by_name">;

const TOGGLES: { key: keyof FormState; label: string }[] = [
  { key: "show_logo",            label: "School logo" },
  { key: "show_motto",           label: "School motto" },
  { key: "show_conduct",         label: "Conduct section" },
  { key: "show_attendance",      label: "Attendance section" },
  { key: "show_finance_balance", label: "Finance balance" },
  { key: "show_grading_scale",   label: "Grading scale legend" },
];

export function ReportCardTemplateSection() {
  const { toast } = useToast();
  const { data: tpl, isError, isLoading, refetch } = useReportCardTemplate();
  const { data: school } = useSchoolProfile();
  const updateTpl = useUpdateReportCardTemplate();

  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (tpl) {
      const { id: _id, updated_at: _u, updated_by: _b, updated_by_name: _n, ...rest } = tpl;
      void _id; void _u; void _b; void _n;
      setForm(rest);
    }
  }, [tpl]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const handleSave = async () => {
    if (!form) return;
    // Critical change — the active report-card template affects every card printed.
    const ok = window.confirm(
      "Update the active report card template?\n\nThis changes how every student's report card is rendered and printed.",
    );
    if (!ok) return;
    try {
      await updateTpl.mutateAsync(form);
      toast({ title: "Report card template saved", variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save template"), variant: "error" });
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-navy">Report Card Template</h3>
          <p className="text-xs text-[#5A6A8A] mt-0.5">Control which sections appear and the header/footer text. Changes are audited.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!form || updateTpl.isPending}
          className="btn-gold flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-60"
        >
          <Save size={13} /> {updateTpl.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      {isError ? (
        <QueryError resource="report card template" onRetry={refetch} />
      ) : isLoading || !form ? (
        <p className="text-sm text-[#8A9ABB] py-6 text-center">Loading template…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Editor */}
          <div className="space-y-4">
            <div>
              <label className="form-label">Header Line</label>
              <input value={form.header_line} onChange={(e) => set("header_line", e.target.value)} className="form-input text-sm" placeholder="Republic of Liberia" />
            </div>
            <div>
              <p className="form-label mb-2">Visible Sections</p>
              <div className="grid grid-cols-2 gap-2">
                {TOGGLES.map((t) => (
                  <label key={t.key} className="flex items-center gap-2 text-sm text-navy rounded-lg border border-[var(--border)] px-3 py-2 cursor-pointer hover:bg-[var(--surface)]">
                    <input
                      type="checkbox"
                      checked={Boolean(form[t.key])}
                      onChange={(e) => set(t.key, e.target.checked as FormState[typeof t.key])}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Teacher Comment Label</label>
                <input value={form.teacher_comment_label} onChange={(e) => set("teacher_comment_label", e.target.value)} className="form-input text-sm" />
              </div>
              <div>
                <label className="form-label">Principal Comment Label</label>
                <input value={form.principal_comment_label} onChange={(e) => set("principal_comment_label", e.target.value)} className="form-input text-sm" />
              </div>
            </div>
            <div>
              <label className="form-label">Principal Signature Text</label>
              <input value={form.principal_signature} onChange={(e) => set("principal_signature", e.target.value)} className="form-input text-sm" placeholder="e.g. Rev. Fr. John Doe, Principal" />
            </div>
            <div>
              <label className="form-label">Footer Text</label>
              <input value={form.footer_text} onChange={(e) => set("footer_text", e.target.value)} className="form-input text-sm" placeholder="Defaults to school name · address · email" />
            </div>
          </div>

          {/* Live preview */}
          <div>
            <p className="form-label mb-2">Preview</p>
            <div className="rounded-lg border-2 border-navy overflow-hidden text-[11px]">
              <div className="bg-navy-deep text-white text-center px-3 py-3" style={{ borderBottom: "3px solid var(--gold)" }}>
                {form.header_line && <div className="text-[8px] uppercase tracking-widest opacity-60">{form.header_line}</div>}
                <div className="flex items-center justify-center gap-2 mt-1">
                  {form.show_logo && (
                    <span className="inline-flex h-6 w-6 rounded-full bg-white/15 items-center justify-center text-[8px]">
                      {school?.logo ? "✓" : "—"}
                    </span>
                  )}
                  <span className="font-serif text-sm font-semibold">{school?.school_name || "Sacred Heart Catholic High School"}</span>
                </div>
                {form.show_motto && (
                  <div className="text-[8px] opacity-60 mt-0.5">&ldquo;{school?.motto || "Ora et Labora"}&rdquo;</div>
                )}
              </div>
              <div className="bg-white text-navy p-3 space-y-2">
                <PreviewRow show label="Subjects &amp; Marks" />
                <PreviewRow show={form.show_attendance} label="Attendance" />
                <PreviewRow show={form.show_conduct} label="Conduct Evaluation" />
                <PreviewRow show={form.show_finance_balance} label="Finance Balance" />
                <PreviewRow show={form.show_grading_scale} label="Grading Scale Legend" />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="border border-[var(--border)] rounded p-1.5 text-[9px] text-[#5A6A8A]">{form.teacher_comment_label}</div>
                  <div className="border border-[var(--border)] rounded p-1.5 text-[9px] text-[#5A6A8A]">{form.principal_comment_label}</div>
                </div>
                {form.principal_signature && (
                  <div className="text-[9px] text-center text-[#5A6A8A] pt-1 border-t border-dashed border-[var(--border)]">{form.principal_signature}</div>
                )}
              </div>
              <div className="bg-navy-deep text-white/60 text-center py-1.5 text-[8px]">
                {form.footer_text || `${school?.school_name || "Sacred Heart Catholic High School"} · ${school?.address || "Monrovia, Liberia"}`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewRow({ show, label }: { show: boolean; label: string }) {
  return (
    <div className={`flex items-center justify-between rounded px-2 py-1.5 ${show ? "bg-[var(--surface)]" : "opacity-30 line-through"}`}>
      <span dangerouslySetInnerHTML={{ __html: label }} />
      <span className="text-[8px] uppercase tracking-wider text-[#8A9ABB]">{show ? "shown" : "hidden"}</span>
    </div>
  );
}
