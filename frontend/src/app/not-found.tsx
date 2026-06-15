import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)] px-4">
      <div className="w-full max-w-sm bg-white rounded-card shadow-lg p-9 text-center">
        <div className="w-14 h-14 rounded-full bg-navy-pale flex items-center justify-center mx-auto mb-4">
          <FileQuestion size={24} className="text-navy" />
        </div>
        <h1 className="text-navy text-lg font-semibold font-serif">Page not found</h1>
        <p className="text-sm text-[#5A6A8A] mt-2">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
        <Link href="/dashboard" className="btn-gold mt-6 w-full flex items-center justify-center">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
