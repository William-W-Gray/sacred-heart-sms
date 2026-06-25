"use client";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useCreateSnapshot } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { SnapshotModule, SnapshotType } from "@/lib/api/services";

const MODULE_OPTIONS: { value: SnapshotModule; label: string }[] = [
  { value: "users",      label: "Users" },
  { value: "students",   label: "Students" },
  { value: "staff",      label: "Staff" },
  { value: "classes",    label: "Classes" },
  { value: "subjects",   label: "Subjects" },
  { value: "attendance", label: "Attendance" },
  { value: "grades",     label: "Grades" },
  { value: "finance",    label: "Finance" },
  { value: "settings",   label: "Settings" },
];

const TYPE_OPTIONS: { value: SnapshotType; label: string }[] = [
  { value: "manual",     label: "Manual" },
  { value: "system",     label: "System" },
  { value: "pre_update", label: "Pre-Update" },
  { value: "pre_delete", label: "Pre-Delete" },
];

const schema = z.object({
  name:        z.string().min(1, "Snapshot name is required"),
  description: z.string().optional(),
  snapshot_type: z.enum(["manual", "system", "pre_update", "pre_delete"]),
  included_modules: z.array(z.string()).min(1, "Select at least one data type to include"),
  confirm: z.literal(true, { message: "You must confirm before creating a snapshot" }),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SnapshotModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const createSnapshot = useCreateSnapshot();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, control, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", snapshot_type: "manual", included_modules: [], confirm: false as true },
  });

  const selectedModules = watch("included_modules") ?? [];

  const close = () => {
    reset({ name: "", description: "", snapshot_type: "manual", included_modules: [], confirm: false as true });
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await createSnapshot.mutateAsync({
        name: data.name,
        description: data.description,
        snapshot_type: data.snapshot_type,
        included_modules: data.included_modules as SnapshotModule[],
        confirm: data.confirm,
      });
      toast({ title: `Snapshot "${data.name}" created`, variant: "success" });
      close();
    } catch (err) {
      setServerError(getApiErrorMessage(err, "Failed to create snapshot"));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-navy font-serif">Create Snapshot</h2>
          <button onClick={close} className="p-1.5 rounded hover:bg-[var(--surface)] text-[#5A6A8A] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {serverError && (
            <div className="px-3 py-2 rounded-lg bg-[var(--err-bg)] border border-[var(--err-border)] text-xs text-[var(--err)]">
              {serverError}
            </div>
          )}

          <div>
            <label className="form-label">Snapshot Name <span className="text-crimson-light">*</span></label>
            <input {...register("name")} className="form-input" placeholder="e.g. Before semester 2 close-out" />
            {errors.name && <p className="text-xs text-[var(--err)] mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea {...register("description")} className="form-input h-20 resize-none" placeholder="Optional notes about why this snapshot was taken" />
          </div>

          <div>
            <label className="form-label">Snapshot Type</label>
            <select {...register("snapshot_type")} className="form-input">
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Include Data <span className="text-crimson-light">*</span></label>
            <Controller
              control={control}
              name="included_modules"
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {MODULE_OPTIONS.map((m) => {
                    const checked = (field.value ?? []).includes(m.value);
                    return (
                      <label
                        key={m.value}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked ? "bg-navy-pale border-navy/30 text-navy font-medium" : "bg-white border-[var(--border-strong)] text-[#5A6A8A]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-navy"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? field.value.filter((v) => v !== m.value)
                              : [...(field.value ?? []), m.value];
                            field.onChange(next);
                          }}
                        />
                        {m.label}
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.included_modules && <p className="text-xs text-[var(--err)] mt-1">{errors.included_modules.message}</p>}
            <p className="text-[11px] text-[var(--muted)] mt-1.5">{selectedModules.length} of {MODULE_OPTIONS.length} selected — only the checked data types are included in the export.</p>
          </div>

          <label className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer">
            <input type="checkbox" {...register("confirm")} className="mt-0.5 accent-navy" />
            <span className="text-xs text-[#5A6A8A]">
              I understand this snapshot captures the selected system data.
            </span>
          </label>
          {errors.confirm && <p className="text-xs text-[var(--err)] -mt-2">{errors.confirm.message}</p>}

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button type="button" onClick={close} className="btn-outline">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-gold flex items-center gap-2 disabled:opacity-60">
              {isSubmitting ? (
                <><span className="w-3.5 h-3.5 border-2 border-navy-deep/30 border-t-navy-deep rounded-full animate-spin" />Creating…</>
              ) : "✓ Create Snapshot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
