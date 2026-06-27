"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Loader2, Save, Lock, Bell, User as UserIcon, Volume2 } from "lucide-react";
import { useProfile, useUpdateProfile, useChangePassword } from "@/hooks/useApi";
import { useAuthStore } from "@/store/auth.store";
import { useToast } from "@/components/ui/toaster";
import { Avatar } from "@/components/shared/Avatar";
import { PasswordChecklist } from "@/components/shared/PasswordChecklist";
import { passwordError } from "@/lib/passwordPolicy";
import { playNotificationChime } from "@/lib/utils/sound";
import { getApiErrorMessage } from "@/lib/utils/errors";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  finance_officer: "Finance Officer",
  teacher: "Teacher",
  student: "Student",
  guardian: "Guardian",
};

export default function MySettingsPage() {
  const { toast } = useToast();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const fetchMe = useAuthStore((s) => s.fetchMe);

  // ── Profile picture ────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // ── Contact + notification preferences ─────────────────────────
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notifySound, setNotifySound] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);

  // ── Password ───────────────────────────────────────────────────
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Seed controlled fields once the profile loads.
  useEffect(() => {
    if (!profile) return;
    setPhone(profile.phone || "");
    setAddress(profile.address || "");
    setNotifySound(profile.notify_sound);
    setNotifyEmail(profile.notify_email);
    setNotifyInApp(profile.notify_in_app);
  }, [profile]);

  // Revoke the object URL when the preview changes/unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (isLoading || !profile) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="skeleton h-7 w-48 rounded-lg" />
        <div className="skeleton h-40 w-full rounded-2xl" />
        <div className="skeleton h-56 w-full rounded-2xl" />
      </div>
    );
  }

  const onPickFile = (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast({ title: "Please choose a JPG, PNG or WEBP image.", variant: "error" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "Image is too large (max 5 MB).", variant: "error" });
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const savePhoto = async () => {
    if (!photoFile) return;
    const fd = new FormData();
    fd.append("photo", photoFile);
    try {
      await updateProfile.mutateAsync(fd);
      toast({ title: "Profile picture updated successfully.", variant: "success" });
      setPhotoFile(null);
      if (preview) { URL.revokeObjectURL(preview); setPreview(null); }
      fetchMe(); // refresh the avatar shown in the topbar/sidebar
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Could not update photo."), variant: "error" });
    }
  };

  const removePhoto = async () => {
    try {
      await updateProfile.mutateAsync({ photo: null });
      toast({ title: "Profile picture removed.", variant: "success" });
      setPhotoFile(null);
      if (preview) { URL.revokeObjectURL(preview); setPreview(null); }
      fetchMe();
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Could not remove photo."), variant: "error" });
    }
  };

  const saveDetails = async () => {
    try {
      await updateProfile.mutateAsync({
        phone,
        address,
        notify_sound: notifySound,
        notify_email: notifyEmail,
        notify_in_app: notifyInApp,
      });
      toast({ title: "Settings saved successfully.", variant: "success" });
      fetchMe();
    } catch (err) {
      toast({ title: getApiErrorMessage(err, "Could not save settings."), variant: "error" });
    }
  };

  const pwCtx = {
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
  };

  const savePassword = async () => {
    if (newPw !== confirmPw) {
      toast({ title: "New passwords do not match.", variant: "error" });
      return;
    }
    const err = passwordError(newPw, pwCtx);
    if (err) {
      toast({ title: err, variant: "error" });
      return;
    }
    try {
      await changePassword.mutateAsync({ old_password: oldPw, new_password: newPw });
      toast({ title: "Password changed successfully.", variant: "success" });
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      toast({ title: getApiErrorMessage(e, "Could not change password. Check your current password."), variant: "error" });
    }
  };

  const displayedPhoto = preview || profile.photo_url;
  const busy = updateProfile.isPending;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">My Settings</h1>
        <p className="text-sm text-[var(--muted)]">Manage your profile, contact details and account security.</p>
      </div>

      {/* ── Profile picture ─────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy mb-4">
          <Camera size={15} className="text-[var(--gold-dim)]" /> Profile Picture
        </h2>
        <div className="flex items-center gap-5 flex-wrap">
          <Avatar
            src={displayedPhoto}
            firstName={profile.first_name}
            lastName={profile.last_name}
            email={profile.email}
            size={88}
          />
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ""; }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
                Choose image
              </button>
              {photoFile && (
                <button type="button" className="btn-gold" onClick={savePhoto} disabled={busy}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save photo
                </button>
              )}
              {profile.photo_url && !photoFile && (
                <button type="button" className="btn-ghost text-crimson-light" onClick={removePhoto} disabled={busy}>
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--muted)]">JPG, PNG or WEBP · max 5 MB. {photoFile && "Preview shown — click Save photo to keep it."}</p>
          </div>
        </div>
      </section>

      {/* ── Account details ─────────────────────────────────────── */}
      <section className="card p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <UserIcon size={15} className="text-[var(--gold-dim)]" /> Account Details
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Name</label>
            <input className="form-input bg-[var(--surface)]" value={`${profile.first_name} ${profile.last_name}`.trim() || "—"} disabled />
          </div>
          <div>
            <label className="form-label">Role</label>
            <input className="form-input bg-[var(--surface)]" value={ROLE_LABEL[profile.role] || profile.role} disabled />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input bg-[var(--surface)]" value={profile.email} disabled />
          </div>
          <div>
            <label className="form-label">Phone Number</label>
            <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +231 77 000 0000" />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Address</label>
            <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" />
          </div>
        </div>
        <p className="text-xs text-[var(--muted)]">Name, email and role are managed by your school administrator.</p>
      </section>

      {/* ── Notification preferences ────────────────────────────── */}
      <section className="card p-5 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Bell size={15} className="text-[var(--gold-dim)]" /> Notification Preferences
        </h2>
        <Toggle label="In-app notifications" hint="Show notifications inside the app." checked={notifyInApp} onChange={setNotifyInApp} />
        <div className="flex items-center justify-between gap-3">
          <Toggle label="Notification sound" hint="Play a sound when a new notification arrives." checked={notifySound} onChange={(v) => { setNotifySound(v); if (v) playNotificationChime(); }} />
          <button type="button" className="btn-outline text-xs flex-shrink-0" onClick={() => playNotificationChime()}>
            <Volume2 size={13} /> Test
          </button>
        </div>
        <Toggle label="Email notifications" hint="Also send important notifications to your email." checked={notifyEmail} onChange={setNotifyEmail} />
      </section>

      <div className="flex justify-end">
        <button type="button" className="btn-navy" onClick={saveDetails} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save changes
        </button>
      </div>

      {/* ── Change password ─────────────────────────────────────── */}
      <section className="card p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Lock size={15} className="text-[var(--gold-dim)]" /> Change Password
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">Current Password</label>
            <input type="password" className="form-input" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label className="form-label">New Password</label>
            <input type="password" className="form-input" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            <PasswordChecklist password={newPw} ctx={pwCtx} />
          </div>
          <div>
            <label className="form-label">Confirm New Password</label>
            <input type="password" className="form-input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
            {confirmPw && newPw !== confirmPw && (
              <p className="mt-1 text-xs text-crimson-light">Passwords do not match.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-navy"
            onClick={savePassword}
            disabled={changePassword.isPending || !oldPw || !newPw || !confirmPw}
          >
            {changePassword.isPending ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Update password
          </button>
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
      <span>
        <span className="block text-sm font-medium text-navy">{label}</span>
        <span className="block text-xs text-[var(--muted)]">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-[var(--gold)]" : "bg-[var(--border)]"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </label>
  );
}
