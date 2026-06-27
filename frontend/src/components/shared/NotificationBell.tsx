"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from "@/hooks/useApi";
import { useAuthStore } from "@/store/auth.store";
import { useToast } from "@/components/ui/toaster";
import { playNotificationChime, installAudioUnlock } from "@/lib/utils/sound";
import type { Notification, NotificationPriority } from "@/types";

const PRIO_DOT: Record<NotificationPriority, string> = {
  urgent: "bg-[var(--err)]",
  high:   "bg-[var(--gold)]",
  normal: "bg-navy/40",
  low:    "bg-[var(--muted)]",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: countData } = useUnreadCount();
  const { data: notifs }    = useNotifications({ page_size: 8 });
  const markRead = useMarkRead();
  const markAll  = useMarkAllRead();
  const { toast } = useToast();
  // Sound is on unless the user muted it in My Settings (default-on when unset).
  const soundEnabled = useAuthStore((s) => s.user?.notify_sound) !== false;

  const unread = countData?.count ?? 0;
  const items: Notification[] = notifs?.results ?? [];

  // Allow the audio context to be unlocked on the first user gesture.
  useEffect(() => { installAudioUnlock(); }, []);

  // Chime + visual toast when the unread count rises (i.e. a new notification
  // arrives via the 30s poll). The first observed value is the baseline, so we
  // never fire on initial load. The sound is best-effort — the toast and the
  // bell badge are the always-visible fallback even if audio is blocked.
  const prevUnread = useRef<number | null>(null);
  useEffect(() => {
    if (prevUnread.current === null) { prevUnread.current = unread; return; }
    if (unread > prevUnread.current) {
      if (soundEnabled) playNotificationChime();
      const latest = items[0];
      toast({ title: latest ? `🔔 ${latest.title}` : "You have a new notification", variant: "info" });
    }
    prevUnread.current = unread;
    // items deliberately excluded — we react to the count, reading items lazily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread, soundEnabled]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-[13px] -m-[13px] rounded-lg text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-[9px] right-[9px] min-w-4 h-4 px-1 bg-crimson-light rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-[0_12px_40px_rgba(13,26,51,0.25)] border border-[var(--border)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-navy">Notifications {unread > 0 && <span className="text-[var(--muted)] font-normal">· {unread} unread</span>}</p>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-[11px] font-medium text-[var(--gold-dim)] hover:text-[var(--gold)] flex items-center gap-1 disabled:opacity-50"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto divide-y divide-[var(--border)]">
            {items.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-[#8A9ABB]">You&apos;re all caught up.</div>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => { if (!n.is_read) markRead.mutate(n.id); }}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-[var(--surface)] transition-colors ${n.is_read ? "" : "bg-[var(--gold-pale)]/40"}`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.is_read ? "bg-transparent" : PRIO_DOT[n.priority] ?? "bg-navy/40"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${n.is_read ? "text-[#5A6A8A]" : "text-navy font-semibold"}`}>{n.title}</p>
                    <span className="text-[10px] text-[#8A9ABB] flex-shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-[#5A6A8A] mt-0.5 line-clamp-2">{n.body}</p>
                  {n.module && <span className="inline-block mt-1 text-[9px] uppercase tracking-wide font-semibold text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded px-1.5 py-0.5">{n.module}</span>}
                </div>
              </button>
            ))}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-xs font-semibold text-[var(--gold-dim)] hover:text-[var(--gold)] border-t border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
          >
            View all notifications →
          </Link>
        </div>
      )}
    </div>
  );
}
