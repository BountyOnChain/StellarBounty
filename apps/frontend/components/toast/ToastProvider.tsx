"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createToast,
  dismissToast,
  removeExpiredToasts,
  type ToastMessage,
  type ToastType,
} from "./toast-store";

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function getToastClasses(type: ToastType) {
  if (type === "success") {
    return "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100";
  }

  return "border-red-500/40 bg-red-50 text-red-900 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-100";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    if (messages.length === 0) return;

    const timer = window.setInterval(() => {
      setMessages((currentMessages) => removeExpiredToasts(currentMessages));
    }, 500);

    return () => window.clearInterval(timer);
  }, [messages.length]);

  const showToast = useCallback((type: ToastType, message: string) => {
    setMessages((currentMessages) => [...currentMessages, createToast(type, message)]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setMessages((currentMessages) => dismissToast(currentMessages, id));
  }, []);

  const value = useMemo(
    () => ({
      success: (message: string) => showToast("success", message),
      error: (message: string) => showToast("error", message),
      dismiss,
    }),
    [dismiss, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="fixed right-4 top-4 z-50 flex w-[min(calc(100vw-2rem),24rem)] flex-col gap-3"
      >
        {messages.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg border px-4 py-3 text-sm shadow-xl shadow-slate-300/50 dark:shadow-slate-950/30 ${getToastClasses(
              toast.type,
            )}`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="leading-6">{toast.message}</p>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="rounded px-1 text-lg leading-6 opacity-80 transition hover:opacity-100"
                onClick={() => dismiss(toast.id)}
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
