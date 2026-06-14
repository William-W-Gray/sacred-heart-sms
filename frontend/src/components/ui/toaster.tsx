"use client";
import { useState, useCallback, createContext, useContext } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  title: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (opts: { title: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  info:    Info,
};

const STYLES: Record<ToastVariant, string> = {
  success: "border-l-4 border-[#2A9D5C]",
  error:   "border-l-4 border-crimson-light",
  info:    "border-l-4 border-[#C8A84B]",
};

const ICON_COLORS: Record<ToastVariant, string> = {
  success: "text-[#2A9D5C]",
  error:   "text-crimson-light",
  info:    "text-[#C8A84B]",
};

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(({ title, variant = "info" }: { title: string; variant?: ToastVariant }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, title, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 bg-navy-deep text-white px-4 py-3 rounded-lg shadow-lg max-w-sm pointer-events-auto animate-in slide-in-from-bottom-2 duration-200 ${STYLES[t.variant]}`}
            >
              <Icon size={16} className={`flex-shrink-0 ${ICON_COLORS[t.variant]}`} />
              <span className="text-sm flex-1">{t.title}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-white/50 hover:text-white transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
