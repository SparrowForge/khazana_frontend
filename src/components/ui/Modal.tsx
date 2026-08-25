"use client";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect } from "react";

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

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

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
