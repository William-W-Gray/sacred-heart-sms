"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)] px-4">
      <div className="w-full max-w-sm bg-white rounded-card shadow-lg p-9 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--err-bg)] flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} className="text-[var(--err)]" />
        </div>
        <h1 className="text-navy text-lg font-semibold font-serif">Something went wrong</h1>
        <p className="text-sm text-[#5A6A8A] mt-2">
          An unexpected error occurred while loading this page. You can try again, or head back to the dashboard.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={reset} className="btn-gold flex-1 flex items-center justify-center">
            Try again
          </button>
          <Link href="/dashboard" className="btn-outline flex-1 flex items-center justify-center">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
