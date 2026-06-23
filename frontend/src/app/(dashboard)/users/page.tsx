"use client";
import { useState } from "react";
import { Plus, Trash2, ShieldCheck, UserX, UserCheck2 } from "lucide-react";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@/hooks/useApi";
import { useToast } from "@/components/ui/toaster";
import { getApiErrorMessage } from "@/lib/utils/errors";
import type { UserRole } from "@/types";

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
  student:         "bg-[var(--navy-pale)] text-[var(--muted)] border-[var(--border)]",
  guardian:        "bg-[var(--warn-bg)] text-[var(--warn)] border-[var(--warn)]/20",
};

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "teacher" as UserRole,
    password: "",
  });
  const createUser = useCreateUser();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: "First and last name are required", variant: "error" }); return;
    }
    if (!form.email) { toast({ title: "Email is required", variant: "error" }); return; }
    if (form.password.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "error" }); return; }
    try {
      await createUser.mutateAsync(form);
      toast({ title: `${form.first_name} ${form.last_name} created successfully`, variant: "success" });
      onClose();
    } catch (err) { toast({ title: getApiErrorMessage(err, "Failed to create user"), variant: "error" }); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-md mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-navy font-serif mb-5">Create User Account</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">First Name *</label>
              <input className="form-input" placeholder="John"
                value={form.first_name} onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input className="form-input" placeholder="Doe"
                value={form.last_name} onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">Email *</label>
            <input type="email" className="form-input" placeholder="user@sacredheart.edu.lr"
              value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Role *</label>
            <select className="form-input" value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Temporary Password *</label>
            <input type="password" className="form-input" placeholder="Min 8 characters"
              value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} />
            <p className="text-xs text-[var(--muted)] mt-1">User should change this after first login.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} disabled={createUser.isPending} className="btn-gold disabled:opacity-60">
            {createUser.isPending ? "Creating…" : "✓ Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const { data, isLoading } = useUsers({ page_size: 100 });
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const users = data?.results ?? [];

  const handleToggleActive = async (id: number, current: boolean, email: string) => {
    try {
      await updateUser.mutateAsync({ id, is_active: !current });
      toast({ title: `${email} ${!current ? "activated" : "deactivated"}`, variant: "success" });
    } catch (err) { toast({ title: getApiErrorMessage(err, "Failed to update user"), variant: "error" }); }
  };

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
    try {
      await deleteUser.mutateAsync(id);
      toast({ title: `${email} deleted`, variant: "success" });
    } catch (err) { toast({ title: getApiErrorMessage(err, "Failed to delete user"), variant: "error" }); }
  };

  const handleRoleChange = async (id: number, role: UserRole) => {
    try {
      await updateUser.mutateAsync({ id, role });
      toast({ title: "Role updated", variant: "success" });
    } catch (err) { toast({ title: getApiErrorMessage(err, "Failed to update role"), variant: "error" }); }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy font-serif">User Management</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">Create and manage staff, teacher, and system accounts</p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="btn-gold flex items-center gap-2">
            <Plus size={15} /> Create User
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">Loading users…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {["Name", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const initials = u.first_name && u.last_name
                      ? `${u.first_name[0]}${u.last_name[0]}`.toUpperCase()
                      : u.email.slice(0, 2).toUpperCase();
                    const displayName = u.first_name
                      ? `${u.first_name} ${u.last_name}`.trim()
                      : "—";
                    return (
                    <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A] flex items-center justify-center text-navy-deep font-bold text-[10px] flex-shrink-0">
                            {initials}
                          </div>
                          <span className="font-medium text-navy">{displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[var(--muted)]">{u.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border cursor-pointer ${ROLE_COLORS[u.role]}`}
                        >
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${u.is_active ? "bg-[var(--ok-bg)] text-[var(--ok)]" : "bg-[var(--err-bg)] text-[var(--err)]"}`}>
                          <ShieldCheck size={10} />
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">
                        {new Date(u.date_joined).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleActive(u.id, u.is_active, u.email)}
                            className="p-1.5 rounded hover:bg-[var(--surface2)] text-[var(--muted)] hover:text-navy transition-colors"
                            title={u.is_active ? "Deactivate" : "Activate"}
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
              {users.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-[var(--muted)] text-sm">
                  <p>No users found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} />}
    </>
  );
}
