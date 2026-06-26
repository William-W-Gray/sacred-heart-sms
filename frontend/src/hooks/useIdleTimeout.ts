"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authApi } from "@/lib/api/services";
import { getRefreshToken, setTokens, clearTokens } from "@/lib/api/client";

// ── Tunables ─────────────────────────────────────────────────────
export const IDLE_LIMIT_MS = 60 * 60 * 1000; // 60 min of inactivity → warn
export const WARN_MS       = 60 * 1000;       // then 60 s countdown → logout
const TICK_MS              = 1000;            // re-evaluate every second
const WRITE_THROTTLE_MS    = 5000;            // persist activity at most every 5 s

// Shared across tabs (localStorage, NOT sessionStorage) so the idle clock is
// machine-wide: opening a second tab or refreshing must NOT reset it, and
// activity / "stay logged in" in any tab keeps every tab alive. The timestamp
// itself is non-sensitive (just "when did someone last touch this device").
const ACTIVITY_KEY = "sms-last-activity";

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "click", "keydown",
  "scroll", "wheel", "touchstart", "touchmove",
] as const;

type Phase = "active" | "warning";

export interface IdleTimeout {
  phase: Phase;
  /** Seconds left on the 60→0 countdown while phase === "warning". */
  secondsLeft: number;
  /** Refresh the token, reset the clock, dismiss the warning. */
  stayLoggedIn: () => Promise<boolean>;
  /** Manual logout from the warning ("Logout Now"). */
  logoutNow: () => Promise<void>;
}

const now = () => Date.now();

const readLastActivity = (): number => {
  if (typeof window === "undefined") return now();
  const raw = window.localStorage.getItem(ACTIVITY_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : now();
};

const writeLastActivity = (ts: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVITY_KEY, String(ts));
};

/**
 * Drives the automatic idle-logout for an authenticated session.
 *
 * - Tracks real user activity (mouse/keyboard/scroll/touch), throttled.
 * - Persists the last-activity timestamp to localStorage so it survives a
 *   refresh and stays in sync across tabs (storage events).
 * - At {@link IDLE_LIMIT_MS} idle it flips to the "warning" phase; the consumer
 *   shows a blocking modal. While warning, activity is intentionally ignored —
 *   only the explicit buttons can resolve it.
 * - At {@link IDLE_LIMIT_MS} + {@link WARN_MS} it auto-logs-out.
 */
export function useIdleTimeout(enabled: boolean): IdleTimeout {
  const [phase, setPhase] = useState<Phase>("active");
  const [secondsLeft, setSecondsLeft] = useState(WARN_MS / 1000);

  const lastActivityRef = useRef<number>(now());
  const lastWriteRef    = useRef<number>(0);
  const phaseRef        = useRef<Phase>("active");
  const busyRef         = useRef(false); // guards the one-shot logout/extend
  phaseRef.current = phase;

  // Record activity (unless the warning is up — then interaction is blocked).
  const markActivity = useCallback(() => {
    if (phaseRef.current === "warning") return;
    const t = now();
    lastActivityRef.current = t;
    if (t - lastWriteRef.current >= WRITE_THROTTLE_MS) {
      lastWriteRef.current = t;
      writeLastActivity(t);
    }
  }, []);

  const resetClock = useCallback(() => {
    const t = now();
    lastActivityRef.current = t;
    lastWriteRef.current = t;
    writeLastActivity(t);
    setPhase("active");
  }, []);

  // Hard logout that clears local state and bounces to /login. `reason`
  // distinguishes the audit event + the login-page message.
  const endAndRedirect = useCallback(async (reason: "timeout" | "manual") => {
    if (busyRef.current) return;
    busyRef.current = true;
    const refresh = getRefreshToken();
    try {
      if (reason === "timeout") {
        // Token still valid here — record the timeout + blacklist server-side.
        await authApi.sessionEvent("timeout", refresh ?? undefined).catch(() => {});
      } else if (refresh) {
        await authApi.logout(refresh).catch(() => {}); // normal "manual" LOGOUT audit
      }
    } finally {
      clearTokens();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("sms-auth");
        window.location.href = reason === "timeout" ? "/login?session=timeout" : "/login";
      }
    }
  }, []);

  const stayLoggedIn = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    try {
      const refresh = getRefreshToken();
      if (refresh) {
        // Refresh the access token so "stay" genuinely extends the session.
        const { access } = await authApi.refresh(refresh);
        setTokens(access, refresh);
      }
      authApi.sessionEvent("extended").catch(() => {});
      resetClock();
      return true;
    } catch {
      // Refresh rejected ⇒ the session is actually dead; treat as a timeout.
      busyRef.current = false;
      await endAndRedirect("timeout");
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [resetClock, endAndRedirect]);

  const logoutNow = useCallback(() => endAndRedirect("manual"), [endAndRedirect]);

  // ── Wire up listeners + the ticking clock ──────────────────────
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Seed from any existing cross-tab/refresh-surviving value.
    const seeded = window.localStorage.getItem(ACTIVITY_KEY);
    if (seeded) lastActivityRef.current = readLastActivity();
    else resetClock();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, markActivity, { passive: true });
    }

    // Cross-tab sync: another tab's activity / extension advances the clock
    // (and dismisses our warning if it lands).
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVITY_KEY || !e.newValue) return;
      const ts = parseInt(e.newValue, 10);
      if (!Number.isFinite(ts)) return;
      lastActivityRef.current = Math.max(lastActivityRef.current, ts);
      if (phaseRef.current === "warning" && now() - ts < IDLE_LIMIT_MS) {
        setPhase("active");
      }
    };
    window.addEventListener("storage", onStorage);

    const tick = window.setInterval(() => {
      const idle = now() - lastActivityRef.current;
      if (idle >= IDLE_LIMIT_MS + WARN_MS) {
        endAndRedirect("timeout");
      } else if (idle >= IDLE_LIMIT_MS) {
        if (phaseRef.current !== "warning") setPhase("warning");
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS + WARN_MS - idle) / 1000)));
      } else if (phaseRef.current === "warning") {
        setPhase("active");
      }
    }, TICK_MS);

    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, markActivity);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(tick);
    };
  }, [enabled, markActivity, resetClock, endAndRedirect]);

  return { phase, secondsLeft, stayLoggedIn, logoutNow };
}
