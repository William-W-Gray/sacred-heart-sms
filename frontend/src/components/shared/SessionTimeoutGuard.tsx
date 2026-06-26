"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useToast } from "@/components/ui/toaster";

const fmt = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/**
 * Mounted inside the authenticated dashboard layout. Runs the idle clock and,
 * once the user has been inactive for an hour, throws up a full-screen blocking
 * modal that either extends the session or logs them out when the 60 s
 * countdown hits zero. Renders nothing while the session is active.
 */
export function SessionTimeoutGuard() {
  const { phase, secondsLeft, stayLoggedIn, logoutNow } = useIdleTimeout(true);
  const { toast } = useToast();
  const [extending, setExtending] = useState(false);
  const stayBtnRef = useRef<HTMLButtonElement>(null);

  const open = phase === "warning";

  // Move focus to the primary action when the dialog appears (accessibility).
  useEffect(() => {
    if (open) stayBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const handleStay = async () => {
    setExtending(true);
    const ok = await stayLoggedIn();
    setExtending(false);
    if (ok) toast({ title: "Your session has been successfully extended.", variant: "success" });
    // If !ok the hook already redirected to /login.
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-deep/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
    >
      <div className="w-full max-w-md rounded-[20px] bg-white shadow-[0_32px_80px_rgba(13,26,51,0.45)] p-6 sm:p-7 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gold-pale)]">
          <ShieldAlert className="h-7 w-7 text-[var(--gold-dim)]" aria-hidden="true" />
        </div>

        <h2 id="session-timeout-title" className="text-xl font-semibold text-navy font-serif">
          Session About to Expire
        </h2>

        <p id="session-timeout-desc" className="mt-2 text-sm text-[#5A6A8A]">
          For your security, your session has been inactive for 1 hour. Your session will
          automatically expire in 1 minute unless you choose to remain signed in.
        </p>

        <div
          role="timer"
          aria-live="assertive"
          aria-atomic="true"
          className="mx-auto my-5 w-fit rounded-xl bg-navy-pale px-6 py-3 font-mono text-3xl font-bold tabular-nums text-navy"
        >
          {fmt(secondsLeft)}
        </div>
        <span className="sr-only">{secondsLeft} seconds remaining before automatic logout.</span>

        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={logoutNow}
            disabled={extending}
            className="btn-outline justify-center disabled:opacity-60"
          >
            Logout Now
          </button>
          <button
            ref={stayBtnRef}
            type="button"
            onClick={handleStay}
            disabled={extending}
            className="btn-gold justify-center flex items-center gap-2 disabled:opacity-60"
          >
            {extending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-deep/30 border-t-navy-deep" />}
            {extending ? "Extending…" : "Stay Logged In"}
          </button>
        </div>
      </div>
    </div>
  );
}
