"use client";
import { useState } from "react";
import {
  Plus, Trash2, ShieldCheck, UserX, UserCheck2, Key, Edit3, Search,
  GraduationCap, UserCheck, Phone, Mail, MapPin, Briefcase
} from "lucide-react";
import {
  useUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useResetUserPassword, useClasses, useStudents, useGuardians,
  useSubjects, useCreateSubject
} from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { getApiErrorMessage } from "@/lib/utils/errors";
import { PasswordChecklist } from "@/components/shared/PasswordChecklist";
import { passwordError } from "@/lib/passwordPolicy";
import type { ManagedUser, CreateUserPayload } from "@/lib/api/services";
import type { UserRole, ClassGroup, Student, Guardian } from "@/types";

interface UserProfileDetails {
  student_id?: string;
  gender?: string;
  current_class_name?: string;
  class_id?: number;
  employee_id?: string;
  subject?: string;
  phone_number?: string;
  homeroom_class_name?: string;
  class_ids?: number[];
  occupation?: string;
  address?: string;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: "admin",           label: "Administrator" },
  { value: "finance_officer", label: "Finance Officer" },
  { value: "teacher",         label: "Teacher" },
  { value: "student",         label: "Student" },
  { value: "guardian",        label: "Guardian" },
];

const ROLE_COLORS: Record<UserRole, string> = {
  admin:           "bg-navy-pale text-navy border-navy/20",
  finance_officer: "bg-[var(--gold-pale)] text-[var(--gold-dim)] border-[var(--gold)]/20",
  teacher:         "bg-[var(--ok-bg)] text-[var(--ok)] border-[var(--ok)]/20",
  student:         "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-200/50",
  guardian:        "bg-[var(--warn-bg)] text-[var(--warn)] border-[var(--warn)]/20",
};

// DEPARTMENTS array removed - using dynamic DB subjects instead

const RELATIONSHIPS = [
  { value: "father",      label: "Father" },
  { value: "mother",      label: "Mother" },
  { value: "uncle",       label: "Uncle" },
  { value: "aunt",        label: "Aunt" },
  { value: "grandparent", label: "Grandparent" },
  { value: "sibling",     label: "Sibling" },
  { value: "other",       label: "Other" },
];

// ── Reset Password Modal ──────────────────────────────────────────
function ResetPasswordModal({ userId, email, onClose }: { userId: number; email: string; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const resetPassword = useResetUserPassword();
  const { toast } = useToast();

  const handleReset = async () => {
    const policyError = passwordError(password, { email });
    if (policyError) {
      toast({ title: policyError, variant: "error" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords do not match", variant: "error" });
      return;
    }
    try {
      await resetPassword.mutateAsync({ id: userId, password });
      toast({ title: `Password reset successfully for ${email}`, variant: "success" });
      onClose();
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to reset password"), variant: "error" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-md mx-4 p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-navy font-serif mb-2">Reset Password</h2>
        <p className="text-xs text-[var(--muted)] mb-4">Set a new password for account: <strong>{email}</strong></p>
        
        <div className="space-y-4">
          <div>
            <label className="form-label">New Password *</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter a strong new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordChecklist password={password} ctx={{ email }} />
          </div>
          <div>
            <label className="form-label">Confirm Password *</label>
            <input
              type="password"
              className="form-input"
              placeholder="Re-enter the new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm && confirm !== password && (
              <p className="mt-1 text-xs text-[#8B1A1A]">Passwords do not match.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleReset} disabled={resetPassword.isPending} className="btn-gold disabled:opacity-60">
            {resetPassword.isPending ? "Resetting…" : "Reset Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Unified User Create / Edit Modal ──────────────────────────────
interface UserModalProps {
  userToEdit?: ManagedUser | null; // If null, we are in "Create" mode
  onClose: () => void;
}

function UserModal({ userToEdit, onClose }: UserModalProps) {
  const isEdit = !!userToEdit;
  const { toast } = useToast();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const { data: classesData } = useClasses();
  const { data: studentsData } = useStudents({ page_size: 100 });
  const { data: guardiansData } = useGuardians({ page_size: 100 });
  const { data: subjectsData } = useSubjects();
  const createSubjectMutation = useCreateSubject();

  const details = userToEdit?.profile_details as UserProfileDetails | undefined | null;

  // Core Account Details
  const [first_name, setFirstName] = useState(userToEdit?.first_name ?? "");
  const [last_name, setLastName] = useState(userToEdit?.last_name ?? "");
  const [email, setEmail] = useState(userToEdit?.email ?? "");
  const [role, setRole] = useState<UserRole>(userToEdit?.role ?? "teacher");
  const [password, setPassword] = useState(""); // Only used on Create
  const [confirmPassword, setConfirmPassword] = useState(""); // Only used on Create

  // Role-Specific Profile Details
  const [student_id, setStudentId] = useState(details?.student_id ?? "");
  const [gender, setGender] = useState(details?.gender ?? "M");
  const [date_of_birth, setDateOfBirth] = useState("");
  const [current_class, setCurrentClass] = useState<number | "">(details?.class_id ?? "");
  
  // Teachers multi-class and subject
  const [employee_id, setEmployeeId] = useState(details?.employee_id ?? "");
  const [subject, setSubject] = useState(details?.subject ?? "");
  const [class_ids, setClassIds] = useState<number[]>(
    details?.class_ids ?? (details?.class_id ? [details.class_id] : [])
  );
  const [phone_number, setPhoneNumber] = useState(details?.phone_number ?? "");

  const [address, setAddress] = useState(details?.address ?? "");
  const [occupation, setOccupation] = useState(details?.occupation ?? "");

  // Profile Relationships (Linking)
  const [guardian_id, setGuardianId] = useState<number | "">("");
  const [student_id_link, setStudentIdLink] = useState<number | "">("");
  const [relationship, setRelationship] = useState("other");

  // Inline Subject form state
  const [showAddSubjectForm, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

  const toggleClass = (id: number) => {
    if (class_ids.includes(id)) {
      setClassIds(class_ids.filter((c) => c !== id));
    } else {
      setClassIds([...class_ids, id]);
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
      setSubject(newSubjectName.trim());
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

  const handleSave = async () => {
    if (!first_name.trim() || !last_name.trim()) {
      toast({ title: "First name and last name are required", variant: "error" });
      return;
    }
    if (!email) {
      toast({ title: "Email is required", variant: "error" });
      return;
    }
    if (!isEdit) {
      const policyError = passwordError(password, { email, firstName: first_name, lastName: last_name, studentId: student_id });
      if (policyError) {
        toast({ title: policyError, variant: "error" });
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: "Passwords do not match", variant: "error" });
        return;
      }
    }

    // Build payload with profile variables
    const payload: Record<string, unknown> = {
      first_name,
      last_name,
      email,
      role,
    };

    if (!isEdit) {
      payload.password = password;
    }

    // Add role specific fields
    if (role === "student") {
      if (student_id.trim()) payload.student_id = student_id;
      payload.gender = gender;
      if (date_of_birth) payload.date_of_birth = date_of_birth;
      if (current_class) payload.current_class = Number(current_class);
      if (guardian_id) {
        payload.guardian_id = Number(guardian_id);
        payload.relationship = relationship;
      }
    } else if (role === "teacher") {
      if (employee_id.trim()) payload.employee_id = employee_id;
      payload.subject = subject;
      payload.phone_number = phone_number;
      payload.class_ids = class_ids;
    } else if (role === "guardian") {
      payload.phone_number = phone_number;
      payload.address = address;
      payload.occupation = occupation;
      if (student_id_link) {
        payload.student_id_link = Number(student_id_link);
        payload.relationship = relationship;
      }
    }

    try {
      if (isEdit) {
        await updateUser.mutateAsync({ id: userToEdit.id, ...payload });
        toast({ title: "User account and profile updated", variant: "success" });
      } else {
        await createUser.mutateAsync(payload as unknown as CreateUserPayload);
        toast({ title: `${first_name} ${last_name} created successfully`, variant: "success" });
      }
      onClose();
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to save user"), variant: "error" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-navy font-serif">
            {isEdit ? `Edit User: ${userToEdit.email}` : "Create User Account"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--muted)]">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: Account Information */}
          <div>
            <h3 className="text-xs font-bold text-navy-deep uppercase tracking-wider mb-3 border-b pb-1">1. Account Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label font-medium">First Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Augustine"
                  value={first_name}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label font-medium">Last Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Gbowee"
                  value={last_name}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className={isEdit ? "sm:col-span-2" : ""}>
                <label className="form-label font-medium">Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. user@sacredheart.edu.lr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {!isEdit && (
                <>
                  <div>
                    <label className="form-label font-medium">Temporary Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <PasswordChecklist password={password} ctx={{ email, firstName: first_name, lastName: last_name, studentId: student_id }} />
                  </div>
                  <div>
                    <label className="form-label font-medium">Confirm Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Re-enter the password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {confirmPassword && confirmPassword !== password && (
                      <p className="mt-1 text-xs text-[#8B1A1A]">Passwords do not match.</p>
                    )}
                  </div>
                </>
              )}
              <div>
                <label className="form-label font-medium">User Role *</label>
                <select
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  disabled={isEdit} // Role changes can lead to inconsistent profiles, better to delete/recreate
                >
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Profile details depending on role */}
          {role === "student" && (
            <div>
              <h3 className="text-xs font-bold text-navy-deep uppercase tracking-wider mb-3 border-b pb-1">2. Student Profile Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Student ID</label>
                  <input
                    className="form-input font-mono"
                    placeholder="e.g. CHS-2026-005 (Auto-generated if blank)"
                    value={student_id}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select className="form-input" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={date_of_birth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Assigned Class *</label>
                  <select
                    className="form-input"
                    value={current_class}
                    onChange={(e) => setCurrentClass(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Select class…</option>
                    {classesData?.results?.map((c: ClassGroup) => (
                      <option key={c.id} value={c.id}>Grade {c.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Optional parent linking */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border)]">
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase text-navy">Link Parent / Guardian (Optional)</p>
                  </div>
                  <div>
                    <label className="form-label">Parent / Guardian</label>
                    <select
                      className="form-input bg-white"
                      value={guardian_id}
                      onChange={(e) => setGuardianId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">— Choose Guardian —</option>
                      {guardiansData?.results?.map((g: Guardian) => (
                        <option key={g.id} value={g.id}>{g.full_name} ({g.email || "No Email"})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Relationship</label>
                    <select
                      className="form-input bg-white"
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                    >
                      {RELATIONSHIPS.map((rel) => (
                        <option key={rel.value} value={rel.value}>{rel.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {role === "teacher" && (
            <div>
              <h3 className="text-xs font-bold text-navy-deep uppercase tracking-wider mb-3 border-b pb-1">2. Teacher Profile Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Employee ID</label>
                  <input
                    className="form-input font-mono"
                    placeholder="e.g. EMP-088 (Auto-generated if blank)"
                    value={employee_id}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="form-label mb-0">Main Subject</label>
                    <button
                      type="button"
                      onClick={() => setShowAddSubject(!showAddSubjectForm)}
                      className="text-[11px] text-[var(--gold)] hover:text-[var(--gold-dim)] hover:underline font-medium transition-colors"
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
                          placeholder="Name"
                          className="form-input text-xs px-2 py-1"
                        />
                        <input
                          type="text"
                          value={newSubjectCode}
                          onChange={(e) => setNewSubjectCode(e.target.value)}
                          placeholder="Code"
                          className="form-input text-xs px-2 py-1 font-mono"
                          maxLength={10}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddNewSubject}
                        disabled={isCreatingSubject}
                        className="btn-gold text-[10px] px-2 py-1 w-full justify-center"
                      >
                        {isCreatingSubject ? "Creating..." : "✓ Save & Select"}
                      </button>
                    </div>
                  ) : (
                    <select className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                      <option value="">Select subject…</option>
                      {subjectsData?.results?.map((sub) => (
                        <option key={sub.id} value={sub.name}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    placeholder="e.g. +231 770 123 456"
                    value={phone_number}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Assigned Homeroom Classes</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {classesData?.results
                      ?.sort((a, b) => b.grade - a.grade || a.section.localeCompare(b.section))
                      .map((c: ClassGroup) => {
                        const selected = class_ids.includes(c.id);
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
                    {!classesData?.results?.length && (
                      <span className="text-xs text-[var(--muted)]">No classes available</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {role === "guardian" && (
            <div>
              <h3 className="text-xs font-bold text-navy-deep uppercase tracking-wider mb-3 border-b pb-1">2. Guardian Profile Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    placeholder="e.g. +231 886 123 456"
                    value={phone_number}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Occupation</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Civil Servant"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Home Address</label>
                  <textarea
                    className="form-input h-16 resize-none"
                    placeholder="e.g. Sinkor, Monrovia"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                {/* Optional child linking */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border)]">
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase text-navy">Link Student / Child (Optional)</p>
                  </div>
                  <div>
                    <label className="form-label">Student</label>
                    <select
                      className="form-input bg-white"
                      value={student_id_link}
                      onChange={(e) => setStudentIdLink(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">— Choose Student —</option>
                      {studentsData?.results?.map((s: Student) => (
                        <option key={s.id} value={s.id}>{s.full_name} ({s.student_id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Relationship</label>
                    <select
                      className="form-input bg-white"
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                    >
                      {RELATIONSHIPS.map((rel) => (
                        <option key={rel.value} value={rel.value}>{rel.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)] sticky bottom-0 bg-white z-10">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} disabled={createUser.isPending || updateUser.isPending} className="btn-gold disabled:opacity-60 flex items-center gap-2">
            {createUser.isPending || updateUser.isPending ? (
              <><span className="w-3 h-3 border-2 border-navy-deep/30 border-t-navy-deep rounded-full animate-spin" />Saving…</>
            ) : "✓ Save Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────
export default function UsersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<ManagedUser | null>(null);
  const [resetUser, setResetUser] = useState<{ id: number; email: string } | null>(null);
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useUsers({ page_size: 100 });
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const users = data?.results ?? [];

  // Local filter logic
  const filteredUsers = users.filter((u) => {
    const name = `${u.first_name} ${u.last_name}`.toLowerCase();
    const email = u.email.toLowerCase();
    const query = search.toLowerCase();
    const matchSearch = name.includes(query) || email.includes(query);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && u.is_active) ||
      (statusFilter === "inactive" && !u.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  const handleToggleActive = async (id: number, current: boolean, email: string) => {
    try {
      await updateUser.mutateAsync({ id, is_active: !current });
      toast({ title: `${email} ${!current ? "activated" : "deactivated"}`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to update user"), variant: "error" });
    }
  };

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Permanently delete ${email}? This will also delete/unbind their linked profile. This cannot be undone.`)) return;
    try {
      await deleteUser.mutateAsync(id);
      toast({ title: `${email} deleted`, variant: "success" });
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Failed to delete user"), variant: "error" });
    }
  };

  const renderProfileSummary = (u: ManagedUser) => {
    const details = u.profile_details as UserProfileDetails | undefined | null;
    if (!details) return <span className="text-[11px] text-[var(--muted)]">— No profile created yet —</span>;

    if (u.role === "student") {
      return (
        <div className="flex flex-col text-xs">
          <div className="flex items-center gap-1 font-medium text-navy">
            <GraduationCap size={12} className="text-[var(--gold)]" />
            <span>ID: {details.student_id} ({details.gender === "M" ? "Male" : "Female"})</span>
          </div>
          {details.current_class_name && (
            <div className="text-[11px] text-[var(--muted)] font-mono mt-0.5">Class: {details.current_class_name}</div>
          )}
        </div>
      );
    }
    if (u.role === "teacher") {
      return (
        <div className="flex flex-col text-xs">
          <div className="flex items-center gap-1 font-medium text-navy">
            <UserCheck size={12} className="text-[var(--gold)]" />
            <span>ID: {details.employee_id} · {details.subject || "—"}</span>
          </div>
          {details.phone_number && (
            <div className="text-[11px] text-[var(--muted)] flex items-center gap-1 mt-0.5">
              <Phone size={10} /> {details.phone_number}
            </div>
          )}
          {details.homeroom_class_name && (
            <div className="text-[11px] text-[var(--gold-dim)] font-medium mt-0.5">Homeroom: Grade {details.homeroom_class_name}</div>
          )}
        </div>
      );
    }
    if (u.role === "guardian") {
      return (
        <div className="flex flex-col text-xs text-[var(--muted)] space-y-0.5">
          {details.phone_number && (
            <div className="flex items-center gap-1 text-navy font-medium">
              <Phone size={11} className="text-[var(--gold)]" />
              <span>{details.phone_number}</span>
            </div>
          )}
          {details.occupation && (
            <div className="flex items-center gap-1 text-[11px]">
              <Briefcase size={10} /> {details.occupation}
            </div>
          )}
          {details.address && (
            <div className="flex items-center gap-1 text-[11px] max-w-[200px] truncate">
              <MapPin size={10} /> {details.address}
            </div>
          )}
        </div>
      );
    }
    return <span className="text-xs text-[var(--muted)]">—</span>;
  };

  return (
    <>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">Unified User Management</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">Configure system users, profiles, role mappings, and passwords</p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="btn-gold flex items-center gap-2 self-start sm:self-auto shadow-sm">
            <Plus size={15} /> Create User Account
          </button>
        </div>
      </div>

      <div className="page-content space-y-4">
        {/* Filters Panel */}
        <div className="card p-4 flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-[var(--muted)]" size={16} />
            <input
              className="form-input pl-9 w-full"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select
              className="form-input min-w-[120px]"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <select
              className="form-input min-w-[120px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* User Accounts Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">
              <span className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin mr-2" />
              Loading system accounts…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[850px]">
                <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <tr>
                    {["Account User", "Role", "Profile Summary", "Status", "Joined", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const initials = u.first_name && u.last_name
                      ? `${u.first_name[0]}${u.last_name[0]}`.toUpperCase()
                      : u.email.slice(0, 2).toUpperCase();
                    const displayName = u.first_name || u.last_name
                      ? `${u.first_name} ${u.last_name}`.trim()
                      : "No Name Set";
                    return (
                      <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-navy leading-none">{displayName}</div>
                              <div className="text-xs text-[var(--muted)] mt-1 flex items-center gap-1">
                                <Mail size={11} className="text-[var(--muted)]" /> {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 vertical-align-top">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-800"}`}>
                            {u.role.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-4 max-w-[250px]">
                          {renderProfileSummary(u)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${u.is_active ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--err-bg)] text-[var(--err)]"}`}>
                            <ShieldCheck size={11} />
                            {u.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-[var(--muted)] font-mono">
                          {new Date(u.date_joined).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setUserToEdit(u)}
                              className="p-1.5 rounded hover:bg-navy-pale text-navy hover:text-navy-deep transition-colors"
                              title="Edit user details & profile"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => setResetUser({ id: u.id, email: u.email })}
                              className="p-1.5 rounded hover:bg-[var(--gold-pale)] text-[var(--gold-dim)] hover:text-navy transition-colors"
                              title="Force reset password"
                            >
                              <Key size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(u.id, u.is_active, u.email)}
                              className="p-1.5 rounded hover:bg-[var(--surface2)] text-[var(--muted)] hover:text-navy transition-colors"
                              title={u.is_active ? "Deactivate user" : "Activate user"}
                            >
                              {u.is_active ? <UserX size={14} /> : <UserCheck2 size={14} />}
                            </button>
                            <button
                              onClick={() => handleDelete(u.id, u.email)}
                              className="p-1.5 rounded hover:bg-[var(--err-bg)] text-[var(--muted)] hover:text-[var(--err)] transition-colors"
                              title="Delete user"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--muted)] text-sm">
                  <p>No user accounts matched the search criteria.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {createOpen && <UserModal onClose={() => setCreateOpen(false)} />}
      {userToEdit && <UserModal userToEdit={userToEdit} onClose={() => setUserToEdit(null)} />}
      {resetUser && (
        <ResetPasswordModal
          userId={resetUser.id}
          email={resetUser.email}
          onClose={() => setResetUser(null)}
        />
      )}
    </>
  );
}
