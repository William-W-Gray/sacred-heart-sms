"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useCreateTeacher, useUpdateTeacher, useSubjects, useClasses, useCreateSubject } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { getApiErrorMessage } from "@/lib/utils/errors";
import { FileUploadZone } from "@/components/ui/FileUploadZone";
import type { Teacher } from "@/types";

const schema = z.object({
  full_name:    z.string().min(1, "Name is required"),
  email:        z.string().email("Valid email required"),
  phone_number: z.string().optional(),
  subject:      z.string().optional(),
  class_ids:    z.array(z.number()).optional(),
  subjects:     z.array(z.number()).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  teacher: Teacher | null;
  onClose: () => void;
}

export function TeacherModal({ open, teacher, onClose }: Props) {
  const { toast }          = useToast();
  const { data: subjects } = useSubjects();
  const { data: classes }  = useClasses();
  const createMutation     = useCreateTeacher();
  const updateMutation     = useUpdateTeacher(teacher?.id ?? 0);
  const createSubjectMutation = useCreateSubject();
  const [savedId, setSavedId] = useState<number | null>(teacher?.id ?? null);

  // Add Subject inline form state
  const [showAddSubjectForm, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const selectedSubjects = watch("subjects") ?? [];
  const selectedClasses = watch("class_ids") ?? [];

  useEffect(() => {
    if (teacher) {
      reset({
        full_name:    teacher.full_name,
        email:        teacher.email,
        phone_number: teacher.phone_number,
        subject:      teacher.subject,
        class_ids:    teacher.class_ids ?? [],
        subjects:     teacher.subjects ?? [],
      });
      setSavedId(teacher.id);
    } else {
      reset({ class_ids: [], subjects: [], subject: "" });
      setSavedId(null);
    }
    setShowAddSubject(false);
  }, [teacher, reset, open]);

  const toggleSubject = (id: number) => {
    const current = selectedSubjects;
    if (current.includes(id)) {
      setValue("subjects", current.filter((s) => s !== id));
    } else {
      setValue("subjects", [...current, id]);
    }
  };

  const toggleClass = (id: number) => {
    const current = selectedClasses;
    if (current.includes(id)) {
      setValue("class_ids", current.filter((c) => c !== id));
    } else {
      setValue("class_ids", [...current, id]);
    }
  };

  const handleAddNewSubject = async () => {
    if (!newSubjectName.trim() || !newSubjectCode.trim()) {
      toast({ title: "Name and code are required", variant: "error" });
      return;
    }
    setIsCreatingSubject(true);
    try {
      await createSubjectMutation.mutateAsync({
        name: newSubjectName.trim(),
        code: newSubjectCode.trim().toUpperCase(),
      });
      setValue("subject", newSubjectName.trim());
      setNewSubjectName("");
      setNewSubjectCode("");
      setShowAddSubject(false);
      toast({ title: `Subject "${newSubjectName}" created and selected`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to create subject"), variant: "error" });
    } finally {
      setIsCreatingSubject(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        class_ids: data.class_ids ?? [],
      };
      if (teacher) {
        await updateMutation.mutateAsync(payload);
        setSavedId(teacher.id);
        toast({ title: `${data.full_name} updated`, variant: "success" });
      } else {
        const res = await createMutation.mutateAsync(payload);
        setSavedId((res as { id: number }).id);
        toast({ title: `${data.full_name} added`, variant: "success" });
      }
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save teacher"), variant: "error" });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-navy font-serif">
            {teacher ? "Edit Teacher" : "Add Teacher"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--surface)] text-[#5A6A8A] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="form-label">Full Name <span className="text-crimson-light">*</span></label>
              <input {...register("full_name")} className="form-input" placeholder="e.g. Mr. Samuel Johnson" />
              {errors.full_name && <p className="text-xs text-[var(--err)] mt-1">{errors.full_name.message}</p>}
            </div>
            <div>
              <label className="form-label">Email <span className="text-crimson-light">*</span></label>
              <input {...register("email")} type="email" className="form-input" placeholder="teacher@sacredheart.edu.lr" />
              {errors.email && <p className="text-xs text-[var(--err)] mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input {...register("phone_number")} className="form-input" placeholder="+231 770 XXX XXX" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="form-label mb-0">Main Subject</label>
                <button
                  type="button"
                  onClick={() => setShowAddSubject(!showAddSubjectForm)}
                  className="text-xs text-[var(--gold)] hover:text-[var(--gold-dim)] hover:underline font-medium transition-colors"
                >
                  {showAddSubjectForm ? "Cancel" : "+ Add New Subject"}
                </button>
              </div>
              
              {showAddSubjectForm ? (
                <div className="p-3 bg-navy-pale rounded-lg border border-[var(--border)] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="Name (e.g. Biology)"
                      className="form-input text-xs px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      value={newSubjectCode}
                      onChange={(e) => setNewSubjectCode(e.target.value)}
                      placeholder="Code (e.g. BIO)"
                      className="form-input text-xs px-2.5 py-1.5 font-mono"
                      maxLength={10}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNewSubject}
                    disabled={isCreatingSubject}
                    className="btn-gold text-[11px] px-3 py-1.5 w-full justify-center"
                  >
                    {isCreatingSubject ? "Creating..." : "✓ Save & Select"}
                  </button>
                </div>
              ) : (
                <select {...register("subject")} className="form-input">
                  <option value="">Select subject…</option>
                  {subjects?.results?.map((sub) => (
                    <option key={sub.id} value={sub.name}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div className="col-span-2">
              <label className="form-label">Assigned Homeroom Classes</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {classes?.results
                  ?.sort((a, b) => b.grade - a.grade || a.section.localeCompare(b.section))
                  .map((c) => {
                    const selected = selectedClasses.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleClass(c.id)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                          selected
                            ? "bg-navy text-white border-navy shadow-sm"
                            : "bg-white text-[#5A6A8A] border-[var(--border-strong)] hover:border-navy hover:text-navy"
                        }`}
                      >
                        Grade {c.name}
                      </button>
                    );
                  })}
                {!classes?.results?.length && (
                  <span className="text-xs text-[var(--muted)]">No classes available</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">Assigned Subjects (Teaching)</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {subjects?.results?.map((sub) => {
                const selected = selectedSubjects.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => toggleSubject(sub.id)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                      selected
                        ? "bg-navy text-white border-navy shadow-sm"
                        : "bg-white text-[#5A6A8A] border-[var(--border-strong)] hover:border-navy hover:text-navy"
                    }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo upload — shown once the record exists */}
          {savedId && (
            <FileUploadZone
              endpoint={`/api/teachers/${savedId}/`}
              fieldName="photo"
              method="patch"
              maxFiles={1}
              maxSize={5 * 1024 * 1024}
              label="Teacher Photo"
              onUploaded={() =>
                toast({ title: "Photo uploaded", variant: "success" })
              }
            />
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="btn-outline">
              {savedId ? "Close" : "Cancel"}
            </button>
            {!savedId && (
              <button type="submit" disabled={isSubmitting} className="btn-gold flex items-center gap-2 disabled:opacity-60">
                {isSubmitting ? (
                  <><span className="w-3.5 h-3.5 border-2 border-navy-deep/30 border-t-navy-deep rounded-full animate-spin" />Saving…</>
                ) : `✓ ${teacher ? "Update" : "Add"} Teacher`}
              </button>
            )}
            {savedId && (
              <button type="button" onClick={onClose} className="btn-gold">✓ Done</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
