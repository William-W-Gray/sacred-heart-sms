"use client";
import { useState, useCallback } from "react";
import { Save } from "lucide-react";
import { useStudents, useConductCategories, useConductRatings, useSaveConductBulk } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";

export default function ConductPage() {
  const { toast }              = useToast();
  const [selStudent, setStudent] = useState("");
  const [selSem,     setSem]   = useState("1");
  const [ratings, setRatings]  = useState<Record<string, 1 | 2 | 3 | 4 | 5 | 6>>({});

  const { data: students }    = useStudents({ page_size: 500 });
  const { data: catData, isError: catError, refetch: refetchCat } = useConductCategories();
  const { data: savedRatings } = useConductRatings(
    selStudent ? { student: selStudent, semester__number: selSem } : undefined,
  );
  const saveConduct = useSaveConductBulk();

  const categories = catData?.results ?? [];

  const getRating = useCallback((catId: number): 1 | 2 | 3 | 4 | 5 | 6 => {
    const key = String(catId);
    if (ratings[key] !== undefined) return ratings[key];
    const saved = savedRatings?.results?.find((r) => r.category === catId);
    return (saved?.rating ?? 3) as 1 | 2 | 3 | 4 | 5 | 6;
  }, [ratings, savedRatings]);

  const setRating = (catId: number, value: 1 | 2 | 3 | 4 | 5 | 6) => {
    setRatings((prev) => ({ ...prev, [String(catId)]: value }));
  };

  const handleSave = async () => {
    if (!selStudent) { toast({ title: "Select a student first", variant: "error" }); return; }
    const records = categories.map((cat) => ({
      student:  Number(selStudent),
      category: cat.id,
      semester: Number(selSem),
      rating:   getRating(cat.id),
    }));
    try {
      await saveConduct.mutateAsync(records);
      setRatings({});
      toast({ title: `Conduct ratings saved for ${categories.length} categories`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save conduct ratings"), variant: "error" });
    }
  };

  const stu = students?.results?.find((s) => String(s.id) === selStudent);

  const RATING_LABELS = ["", "Poor", "Fair", "Average", "Good", "Very Good", "Excellent"];

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Conduct Evaluation</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">14 categories · 1 (Poor) to 6 (Excellent)</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saveConduct.isPending || !selStudent}
            className="btn-gold flex items-center gap-2 disabled:opacity-60"
          >
            <Save size={15} />
            {saveConduct.isPending ? "Saving…" : "Save Ratings"}
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Left — selector */}
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-navy mb-4">Select Student</h3>
              <div className="space-y-4">
                <div>
                  <label className="form-label">Student</label>
                  <select
                    value={selStudent}
                    onChange={(e) => { setStudent(e.target.value); setRatings({}); }}
                    className="form-input text-sm"
                  >
                    <option value="">Select student…</option>
                    {students?.results?.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name} — {s.student_id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Semester</label>
                  <select value={selSem} onChange={(e) => { setSem(e.target.value); setRatings({}); }} className="form-input text-sm">
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </select>
                </div>

                {stu && (
                  <div className="bg-navy-pale rounded-lg p-4 text-sm space-y-2 border border-[var(--border)]">
                    <div className="flex justify-between"><span className="text-[#5A6A8A]">Name</span><span className="font-medium">{stu.full_name}</span></div>
                    <div className="flex justify-between"><span className="text-[#5A6A8A]">ID</span><span className="font-mono text-xs">{stu.student_id}</span></div>
                    <div className="flex justify-between"><span className="text-[#5A6A8A]">Class</span><span>{stu.class_name ?? "—"}</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* Rating guide */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-navy mb-3">Rating Guide</h3>
              <div className="space-y-1.5">
                {[1,2,3,4,5,6].map((n) => (
                  <div key={n} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-[var(--gold)] text-navy-deep flex items-center justify-center text-xs font-bold flex-shrink-0">{n}</span>
                    <span className="text-[#5A6A8A]">{RATING_LABELS[n]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — categories */}
          <div className="col-span-2">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <h3 className="text-sm font-semibold text-navy">Conduct Categories</h3>
                {stu && <span className="badge-ok">Sem {selSem}</span>}
              </div>
              <div className="divide-y divide-[var(--border)]">
                {catError ? (
                  <QueryError resource="conduct categories" onRetry={refetchCat} />
                ) : categories.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-[#8A9ABB]">
                    Loading categories…
                  </div>
                ) : categories.map((cat) => {
                  const current = getRating(cat.id);
                  return (
                    <div key={cat.id} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--surface)] transition-colors">
                      <span className="text-sm text-navy">{cat.name}</span>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5,6].map((n) => (
                          <button
                            key={n}
                            onClick={() => selStudent && setRating(cat.id, n as 1 | 2 | 3 | 4 | 5 | 6)}
                            disabled={!selStudent}
                            title={RATING_LABELS[n]}
                            className={`text-xl transition-colors leading-none disabled:cursor-not-allowed ${
                              n <= current ? "text-[#C8A84B]" : "text-[var(--surface2)] hover:text-[#E8C96A]"
                            }`}
                          >
                            ★
                          </button>
                        ))}
                        <span className="ml-2 text-xs text-[#5A6A8A] w-16 text-right">
                          {selStudent ? RATING_LABELS[current] : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
