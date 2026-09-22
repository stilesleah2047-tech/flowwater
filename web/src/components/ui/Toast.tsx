"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const kindStyles: Record<ToastKind, string> = {
  success: "border-confirm-500/30 bg-depth-900 text-confirm-400",
  error: "border-alert-500/30 bg-depth-900 text-alert-400",
  info: "border-flow-500/30 bg-depth-900 text-flow-400",
};

const kindIcon: Record<ToastKind, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

/**
 * Every mutating action in the app (create staff, save a price, record a
 * sale, etc.) previously gave the person no explicit confirmation beyond
 * the page silently re-rendering. This provider gives every one of those
 * actions a brief, consistent "yes, that worked" (or "no, here's why not")
 * moment. Wrap the app root with <ToastProvider>, then call
 * `const { show } = useToast()` anywhere and `show("Saved", "success")`.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:right-6 sm:left-auto"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              "pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl2 border px-4 py-3 shadow-soft animate-fade-up " +
              kindStyles[t.kind]
            }
          >
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
              {kindIcon[t.kind]}
            </span>
            <span className="text-sm font-medium text-white">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
