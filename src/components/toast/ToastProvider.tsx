import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

const TOAST_DURATION = 4000;

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  exiting?: boolean;
  createdAt: number;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: "var(--success)",
  error: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--accent)",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message, createdAt: Date.now() }]);
    setTimeout(() => removeToast(id), TOAST_DURATION);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
        {toasts.map((t) => {
          const Icon = icons[t.type];
          const color = colors[t.type];
          return (
            <div
              key={t.id}
              className={`relative overflow-hidden rounded-xl border pointer-events-auto glass-card ${t.exiting ? "animate-toast-out" : "animate-toast-in"}`}
              style={{ borderColor: "var(--border)", boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15), inset 3px 0 0 ${color}` }}
            >
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Icon size={18} style={{ color, flexShrink: 0 }} />
                <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{t.message}</span>
                <button onClick={() => removeToast(t.id)} className="flex-shrink-0 transition-colors" style={{ color: "var(--text-secondary)" }}>
                  <X size={14} />
                </button>
              </div>
              {!t.exiting && (
                <div
                  className="absolute bottom-0 left-0 h-[2px] toast-timer"
                  style={{ background: color, animationDuration: `${TOAST_DURATION}ms` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
