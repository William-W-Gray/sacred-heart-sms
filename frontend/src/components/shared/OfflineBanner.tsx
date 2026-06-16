"use client";
import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

type Status = "online" | "offline" | "back";

export function OfflineBanner() {
  const [status, setStatus] = useState<Status>("online");

  useEffect(() => {
    if (!navigator.onLine) setStatus("offline");

    let hideTimer: ReturnType<typeof setTimeout>;

    const onOffline = () => {
      clearTimeout(hideTimer);
      setStatus("offline");
    };
    const onOnline = () => {
      setStatus("back");
      // Show "reconnected" briefly, then hide the banner
      hideTimer = setTimeout(() => setStatus("online"), 3000);
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (status === "online") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium shadow-lg transition-all duration-300 ${
        status === "offline"
          ? "bg-[var(--err)] text-white"
          : "bg-[var(--ok)] text-white"
      }`}
    >
      {status === "offline" ? (
        <>
          <WifiOff size={14} className="flex-shrink-0" />
          You&rsquo;re offline — data shown may be from cache. Changes cannot be saved until you reconnect.
        </>
      ) : (
        <>
          <Wifi size={14} className="flex-shrink-0" />
          Back online — refreshing data…
        </>
      )}
    </div>
  );
}
