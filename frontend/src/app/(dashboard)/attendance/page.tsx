"use client";
import { useState, useCallback } from "react";
import { Save, BarChart2 } from "lucide-react";
import { useStudents, useClasses, useSubjects, useAttendance, useSaveAttendanceBulk } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { QueryError } from "@/components/shared/QueryError";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { AttendanceStatus } from "@/types";

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "border-[var(--ok)] bg-[var(--ok-bg)] text-[var(--ok)] font-medium",
  late:    "border-[var(--warn)] bg-[var(--warn-bg)] text-[var(--warn)] font-medium",
  absent:  "border-crimson-light bg-[var(--err-bg)] text-crimson font-medium",
  excused: "border-blue-400 bg-blue-50 text-blue-700 font-medium",
};
const STATUSES: AttendanceStatus[] = ["present", "late", "absent"];

export default function AttendancePage() {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];

  const [selClass,   setClass]  = useState("");
  const [selSubject, setSubject] = useState("");
  const [selDate,    setDate]   = useState(today);
  const [drafts, setDrafts]     = useState<Record<number, AttendanceStatus>>({});

  const { data: classes  } = useClasses();
  const { data: subjects } = useSubjects();
  const { data: students, isError: studentsError, refetch: refetchStudents } = useStudents(selClass ? { current_class: selClass, page_size: 100 } : undefined);

  const { data: savedAttendance } = useAttendance(
    selClass && selSubject && selDate
      ? { class_group: selClass, subject: selSubject, date: selDate, page_size: 100 }
      : undefined,
  );

  const saveAttendance = useSaveAttendanceBulk();

  const getStatus = useCallback((studentId: number): AttendanceStatus => {
    if (drafts[studentId]) return drafts[studentId];
    const saved = savedAttendance?.results?.find((a) => a.student === studentId);
    return saved?.status ?? "present";
  }, [drafts, savedAttendance]);

  const setStudentStatus = (studentId: number, status: AttendanceStatus) => {
    setDrafts((prev) => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status: AttendanceStatus) => {
    const all: Record<number, AttendanceStatus> = {};
    students?.results?.forEach((s) => { all[s.id] = status; });
    setDrafts(all);
  };

  const handleSave = async () => {
    if (!selClass || !selSubject || !selDate) {
      toast({ title: "Select class, subject and date", variant: "error" });
      return;
    }
    const records = (students?.results ?? []).map((s) => ({
      student:     s.id,
      subject:     Number(selSubject),
      class_group: Number(selClass),
      date:        selDate,
      status:      getStatus(s.id),
    }));
    try {
      await saveAttendance.mutateAsync(records);
      setDrafts({});
      toast({ title: `Attendance saved for ${records.length} students`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save attendance"), variant: "error" });
    }
  };

  const studs = students?.results ?? [];

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Attendance Registry</h1>
            <p className="text-sm text-[#5A6A8A] mt-0.5">Record per-subject daily attendance</p>
          </div>
          <div className="flex gap-3">
            <button className="btn-outline flex items-center gap-2">
              <BarChart2 size={15} /> Report
            </button>
            <button
              onClick={handleSave}
              disabled={saveAttendance.isPending || !selClass || !selSubject}
              className="btn-gold flex items-center gap-2 disabled:opacity-60"
            >
              <Save size={15} />
              {saveAttendance.isPending ? "Saving…" : "Save Attendance"}
            </button>
          </div>
        </div>

        {/* Selectors */}
        <div className="flex gap-3 mt-4 flex-wrap">
          <select value={selClass} onChange={(e) => setClass(e.target.value)} className="form-input w-40 text-sm">
            <option value="">Select Class</option>
            {classes?.results?.map((c) => (
              <option key={c.id} value={c.id}>Grade {c.name}</option>
            ))}
          </select>
          <select value={selSubject} onChange={(e) => setSubject(e.target.value)} className="form-input w-48 text-sm">
            <option value="">Select Subject</option>
            {subjects?.results?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={selDate}
            onChange={(e) => setDate(e.target.value)}
            className="form-input w-40 text-sm"
          />
        </div>
      </div>

      <div className="page-content space-y-4">
        {(!selClass || !selSubject) ? (
          <div className="card flex flex-col items-center justify-center h-64 text-[#8A9ABB]">
            <div className="text-4xl mb-3">📅</div>
            <p className="font-medium">Select class and subject to record attendance</p>
          </div>
        ) : studentsError ? (
          <div className="card">
            <QueryError resource="students" onRetry={refetchStudents} />
          </div>
        ) : studs.length === 0 ? (
          <div className="card flex flex-col items-center justify-center h-48 text-[#8A9ABB]">
            <p>No students in this class</p>
          </div>
        ) : (
          <>
            {/* Quick-mark all */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#5A6A8A] font-medium">Mark all as:</span>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => markAll(s)}
                  className={`px-3 py-1 text-xs rounded border transition-colors capitalize ${STATUS_STYLES[s]}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-[var(--surface)]">
                    <tr>
                      {["#", "Student", "ID", "Status", "Overall Att%"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#5A6A8A] uppercase tracking-wider border-b border-[var(--border)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studs.map((student, idx) => {
                      const status = getStatus(student.id);
                      return (
                        <tr key={student.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                          <td className="px-4 py-3 text-[#8A9ABB] text-xs">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-navy">{student.full_name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#5A6A8A]">{student.student_id}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {STATUSES.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => setStudentStatus(student.id, s)}
                                  className={`px-3 py-1.5 text-xs rounded border transition-all capitalize ${
                                    status === s
                                      ? STATUS_STYLES[s]
                                      : "border-[var(--border-strong)] bg-white text-[#5A6A8A] hover:border-navy hover:text-navy"
                                  }`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {/* Placeholder — real value from attendance summary API */}
                            <span className="text-xs text-[#5A6A8A]">—</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
