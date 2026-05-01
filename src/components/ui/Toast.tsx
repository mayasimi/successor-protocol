"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

// Simple module-level event bus
type Listener = (toast: ToastMessage) => void;
const listeners: Listener[] = [];

function emit(toast: ToastMessage) {
  listeners.forEach((l) => l(toast));
}

export const showToast = {
  success: (message: string) =>
    emit({ id: crypto.randomUUID(), message, type: "success" }),
  error: (message: string) =>
    emit({ id: crypto.randomUUID(), message, type: "error" }),
  info: (message: string) =>
    emit({ id: crypto.randomUUID(), message, type: "info" }),
};

const typeStyles: Record<ToastType, string> = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-primary text-white",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3500);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={cn(
            "px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in",
            typeStyles[t.type]
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
