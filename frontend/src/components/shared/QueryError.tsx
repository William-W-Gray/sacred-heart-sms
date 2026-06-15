import { AlertTriangle } from "lucide-react";

interface Props {
  resource: string;
  onRetry?: () => void;
}

export function QueryError({ resource, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
      <AlertTriangle size={28} className="text-[var(--err)] mb-3" />
      <p className="font-medium text-navy">Failed to load {resource}</p>
      <p className="text-sm text-[#5A6A8A] mt-1 max-w-sm">
        Something went wrong while fetching this data. Check your connection and try again.
      </p>
      {onRetry && (
        <button onClick={() => onRetry()} className="btn-outline mt-4 text-sm">
          Retry
        </button>
      )}
    </div>
  );
}
