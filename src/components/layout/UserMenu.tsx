"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, User as UserIcon, KeyRound } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";
import ChangePasswordModal from "./ChangePasswordModal";

/**
 * Authenticated-user indicator in the sidebar footer. Clicking the user's name
 * toggles a floating dropdown (opens upward) with exactly two actions: Profile
 * and Change Password. Closes on outside-click or Escape.
 */
export default function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-close on click outside the menu window space or Escape key.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const displayName = user?.name ?? user?.userName ?? "User";

  const goProfile = () => {
    setIsOpen(false);
    router.push("/profile");
  };

  const openChangePassword = () => {
    setIsOpen(false);
    setPwOpen(true);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={collapsed ? displayName : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-slate-300 hover:bg-slate-700 hover:text-white transition-colors",
          collapsed ? "w-full justify-center" : "w-full justify-between"
        )}
      >
        {collapsed ? (
          <UserIcon size={16} className="shrink-0" />
        ) : (
          <>
            <span className="flex items-center gap-2 min-w-0">
              <UserIcon size={16} className="shrink-0" />
              <span className="truncate text-sm font-medium">{displayName}</span>
            </span>
            <ChevronUp
              size={14}
              className={cn("shrink-0 transition-transform", isOpen ? "" : "rotate-180")}
            />
          </>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-40 overflow-hidden rounded-md border border-slate-600 bg-slate-700 shadow-lg",
            collapsed ? "bottom-0 left-full ml-1" : "bottom-full left-0 mb-1 w-full"
          )}
        >
          <button
            role="menuitem"
            onClick={goProfile}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-600 hover:text-white transition-colors"
          >
            <UserIcon size={14} /> Profile
          </button>
          <button
            role="menuitem"
            onClick={openChangePassword}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-600 hover:text-white transition-colors"
          >
            <KeyRound size={14} /> Change Password
          </button>
        </div>
      )}

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
