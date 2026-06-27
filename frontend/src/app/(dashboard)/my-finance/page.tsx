"use client";

import { useEffect, useState } from "react";
import { CreditCard, Users } from "lucide-react";
import { useStudents } from "@/hooks/useApi";
import { useAuthStore } from "@/store/auth.store";
import { StudentFinanceView } from "@/components/finance/StudentFinanceView";

export default function MyFinancePage() {
  const { role } = useAuthStore();
  const { data, isLoading } = useStudents({ page_size: 200 });
  const students = data?.results ?? [];
  const [selected, setSelected] = useState<number | null>(null);
  const firstId = students[0]?.id;

  useEffect(() => {
    if (selected == null && firstId != null) setSelected(firstId);
  }, [firstId, selected]);

  const isGuardian = role === "guardian";
  const multiChild = isGuardian && students.length > 1;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-navy">
            <CreditCard size={18} className="text-[var(--gold-dim)]" /> {isGuardian ? "Children's Finance" : "My Finance"}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {isGuardian ? "Fees, payments and receipts for your child / children." : "Your fees, payments, balances and receipts."}
          </p>
        </div>
        {multiChild && (
          <div className="flex items-center gap-2">
            <Users size={15} className="text-[var(--muted)]" />
            <select
              className="form-input !w-auto py-1.5"
              value={selected ?? ""}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}{s.class_name ? ` · ${s.class_name}` : ""}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
          <div className="skeleton h-48 rounded-xl" />
        </div>
      ) : students.length === 0 ? (
        <div className="card p-10 text-center">
          <CreditCard size={32} className="mx-auto text-[var(--muted)] mb-3" />
          <p className="text-sm font-medium text-navy">No finance records found</p>
          <p className="text-xs text-[var(--muted)]">
            {isGuardian ? "No student is linked to your guardian account yet." : "Your student record isn't linked yet. Contact the school office."}
          </p>
        </div>
      ) : selected != null ? (
        <>
          {isGuardian && (
            <p className="text-sm text-[#5A6A8A]">
              Showing finance for <span className="font-semibold text-navy">{students.find((s) => s.id === selected)?.full_name}</span>.
            </p>
          )}
          <StudentFinanceView studentId={selected} />
        </>
      ) : null}
    </div>
  );
}
