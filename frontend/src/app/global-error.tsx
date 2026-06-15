"use client";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F4F3EF] text-navy antialiased font-sans">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-white rounded-card shadow-lg p-9 text-center">
            <h1 className="text-navy text-lg font-semibold font-serif">Something went wrong</h1>
            <p className="text-sm text-[#5A6A8A] mt-2">
              The application failed to load. Please reload the page.
            </p>
            <button onClick={reset} className="btn-gold mt-6 w-full flex items-center justify-center">
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
