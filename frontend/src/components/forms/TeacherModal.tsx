"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useCreateTeacher, useUpdateTeacher, useSubjects, useClasses } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { Teacher } from "@/types";

const schema = z.object({
  full_name:    z.string().min(1, "Name is required"),
  email:        z.string().email("Valid email required"),
  phone_number: z.string().optional(),
  department:   z.string().optional(),
  class_id:     z.string().optional(),
  subjects:     z.array(z.number()).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  teacher: Teacher | null;
  onClose: () => void;
}

const DEPARTMENTS = [
  "Sciences", "Mathematics", "Arts & Humanities",
  "Social Sciences", "Physical Education", "Religious Studies", "Vocational",
];

export function TeacherModal({ open, teacher, onClose }: Props) {
  const { toast }          = useToast();
  const { data: subjects } = useSubjects();
  const { data: classes }  = useClasses();
  const createMutation     = useCreateTeacher();
  const updateMutation     = useUpdateTeacher(teacher?.id ?? 0);

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const selectedSubjects = watch("subjects") ?? [];

  useEffect(() => {
    if (teacher) {
      reset({
        full_name:    teacher.full_name,
        email:        teacher.email,
        phone_number: teacher.phone_number,
        department:   teacher.department,
        class_id:     teacher.class_id ? String(teacher.class_id) : "",
        subjects:     teacher.subjects ?? [],
      });
    } else {
      reset({ subjects: [] });
    }
  }, [teacher, reset]);

  const toggleSubject = (id: number) => {
    const current = selectedSubjects;
    if (current.includes(id)) {
      setValue("subjects", current.filter((s) => s !== id));
    } else {
      setValue("subjects", [...current, id]);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        class_id: data.class_id ? Number(data.class_id) : null,
      };
      if (teacher) {
        await updateMutation.mutateAsync(payload);
        toast({ title: `${data.full_name} updated`, variant: "success" });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: `${data.full_name} added`, variant: "success" });
      }
      onClose();
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save teacher"), variant: "error" });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-card shadow-lg w-full max-w-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-navy font-serif">
            {teacher ? "Edit Teacher" : "Add Teacher"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--surface)] text-[#5A6A8A] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <label className="form-label">Department</label>
              <select {...register("department")} className="form-input">
                <option value="">Select department…</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="form-label">Assigned Class (Homeroom)</label>
              <select {...register("class_id")} className="form-input">
                <option value="">— None —</option>
                {classes?.results?.sort((a, b) => b.grade - a.grade || a.section.localeCompare(b.section))
                  .map((c) => <option key={c.id} value={c.id}>Grade {c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Assigned Subjects</label>
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
                        ? "bg-navy text-white border-navy"
                        : "bg-white text-[#5A6A8A] border-[var(--border-strong)] hover:border-navy hover:text-navy"
                    }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-gold flex items-center gap-2 disabled:opacity-60">
              {isSubmitting ? (
                <><span className="w-3.5 h-3.5 border-2 border-navy-deep/30 border-t-navy-deep rounded-full animate-spin" />Saving…</>
              ) : `✓ ${teacher ? "Update" : "Add"} Teacher`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
