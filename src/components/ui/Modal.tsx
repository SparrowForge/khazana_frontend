"use client";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/** Every dialog currently on screen, innermost last. Escape closes only the one
 *  on top: a confirmation opened over a half-filled form must not take the form
 *  (and everything typed into it) down with it. */
const openDialogs: object[] = [];

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  // Held in a ref so an inline `onClose` — redefined on every render — doesn't
  // re-register this dialog and push it back to the top of the stack.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const token = useRef({}).current;

  useEffect(() => {
    if (!open) return;
    openDialogs.push(token);
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openDialogs[openDialogs.length - 1] !== token) return;
      closeRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      const i = openDialogs.indexOf(token);
      if (i !== -1) openDialogs.splice(i, 1);
    };
  }, [open, token]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Green title bar over a sage panel — the legacy form, as a dialog. */}
      <div className={cn("relative bg-sage-100 rounded-lg shadow-xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden border border-sage-400", sizes[size])}>
        {title && (
          <div className="flex items-center justify-between px-6 py-3 bg-primary-800">
            <h3 className="text-base font-bold text-titlebar">{title}</h3>
            <button onClick={onClose} className="text-titlebar/70 hover:text-titlebar transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}
