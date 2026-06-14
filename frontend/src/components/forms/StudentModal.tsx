"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useCreateStudent, useUpdateStudent, useClasses } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import type { Student } from "@/types";

const schema = z.object({
  student_id:   z.string().min(1, "Student ID is required"),
  first_name:   z.string().min(1, "First name is required"),
  middle_name:  z.string().optional(),
  last_name:    z.string().min(1, "Last name is required"),
  gender:       z.enum(["M", "F"], { required_error: "Select gender" }),
  date_of_birth: z.string().optional(),
  current_class: z.string().min(1, "Class is required"),
  status:       z.enum(["active","suspended","transferred","graduated","withdrawn"]),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  student: Student | null;
  onClose: () => void;
}

export function StudentModal({ open, student, onClose }: Props) {
  const { toast }          = useToast();
  const { data: classes }  = useClasses();
  const createMutation     = useCreateStudent();
  const updateMutation     = useUpdateStudent(student?.id ?? 0);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active" },
  });

  useEffect(() => {
    if (student) {
      reset({
        student_id:    student.student_id,
        first_name:    student.first_name,
        middle_name:   student.middle_name,
        last_name:     student.last_name,
        gender:        student.gender,
        date_of_birth: student.date_of_birth ?? "",
        current_class: String(student.current_class ?? ""),
        status:        student.status,
      });
    } else {
      reset({ status: "active" });
    }
  }, [student, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        current_class: Number(data.current_class),
      };
      if (student) {
        await updateMutation.mutateAsync(payload);
        toast({ title: `${data.first_name} ${data.last_name} updated`, variant: "success" });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: `${data.first_name} ${data.last_name} enrolled`, variant: "success" });
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { student_id?: string[] } } })
        ?.response?.data?.student_id?.[0];
      toast({
        title: detail ?? "Failed to save student",
        variant: "error",
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-card shadow-lg w-full max-w-2xl max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-navy font-serif">
            {student ? "Edit Student" : "Enrol New Student"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--surface)] text-[#5A6A8A] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* First name */}
            <div>
              <label className="form-label">First Name <span className="text-crimson-light">*</span></label>
              <input {...register("first_name")} className="form-input" placeholder="e.g. Mary-Rose" />
              {errors.first_name && <p className="text-xs text-[var(--err)] mt-1">{errors.first_name.message}</p>}
            </div>
            {/* Middle name */}
            <div>
              <label className="form-label">Middle Name</label>
              <input {...register("middle_name")} className="form-input" placeholder="Optional" />
            </div>
            {/* Last name */}
            <div>
              <label className="form-label">Last Name <span className="text-crimson-light">*</span></label>
              <input {...register("last_name")} className="form-input" placeholder="e.g. Kollie" />
              {errors.last_name && <p className="text-xs text-[var(--err)] mt-1">{errors.last_name.message}</p>}
            </div>
            {/* Student ID */}
            <div>
              <label className="form-label">Student ID <span className="text-crimson-light">*</span></label>
              <input {...register("student_id")} className="form-input font-mono" placeholder="e.g. CHS-2026-001" />
              <p className="text-[11px] text-[#8A9ABB] mt-1">Custom ID — entered manually, must be unique</p>
              {errors.student_id && <p className="text-xs text-[var(--err)] mt-1">{errors.student_id.message}</p>}
            </div>
            {/* Gender */}
            <div>
              <label className="form-label">Gender <span className="text-crimson-light">*</span></label>
              <select {...register("gender")} className="form-input">
                <option value="">Select gender…</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
              {errors.gender && <p className="text-xs text-[var(--err)] mt-1">{errors.gender.message}</p>}
            </div>
            {/* DOB */}
            <div>
              <label className="form-label">Date of Birth</label>
              <input {...register("date_of_birth")} type="date" className="form-input" />
            </div>
            {/* Class */}
            <div>
              <label className="form-label">Class <span className="text-crimson-light">*</span></label>
              <select {...register("current_class")} className="form-input">
                <option value="">Select class…</option>
                {classes?.results?.map((c) => (
                  <option key={c.id} value={c.id}>Grade {c.name}</option>
                ))}
              </select>
              {errors.current_class && <p className="text-xs text-[var(--err)] mt-1">{errors.current_class.message}</p>}
            </div>
            {/* Status */}
            <div>
              <label className="form-label">Status</label>
              <select {...register("status")} className="form-input">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="transferred">Transferred</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)] mt-6">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-gold flex items-center gap-2 disabled:opacity-60">
              {isSubmitting ? (
                <><span className="w-3.5 h-3.5 border-2 border-navy-deep/30 border-t-navy-deep rounded-full animate-spin" />Saving…</>
              ) : (
                `✓ ${student ? "Update" : "Enrol"} Student`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
