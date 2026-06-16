"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, WifiOff } from "lucide-react";

interface Props {
  resource: string;
  onRetry?: () => void;
}

export function QueryError({ resource, onRetry }: Props) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOnline  = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${offline ? "bg-[var(--warn-bg)]" : "bg-[var(--err-bg)]"}`}>
        {offline
          ? <WifiOff size={22} className="text-[var(--warn)]" />
          : <AlertTriangle size={22} className="text-[var(--err)]" />}
      </div>
      <p className="font-semibold text-navy">
        {offline ? "You're offline" : `Failed to load ${resource}`}
      </p>
      <p className="text-sm text-[#5A6A8A] mt-1 max-w-xs">
        {offline
          ? "Connect to the internet to load this data. Cached data is shown where available."
          : "Something went wrong fetching this data. Check your connection and try again."}
      </p>
      {onRetry && !offline && (
        <button onClick={onRetry} className="btn-outline mt-4 text-sm">
          Retry
        </button>
      )}
      {offline && (
        <p className="text-xs text-[var(--muted)] mt-4">
          The page will refresh automatically when you reconnect.
        </p>
      )}
    </div>
  );
}
