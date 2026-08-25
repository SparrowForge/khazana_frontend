"use client";
import { useAuthStore } from "@/store/auth.store";
import { formatDate } from "@/lib/utils";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="h-14 bg-primary-800 flex items-center justify-between px-6 shrink-0">
      <h2 className="text-lg font-bold text-titlebar">{title}</h2>
      <div className="flex items-center gap-4 text-sm text-sage-100">
        <span>{formatDate(new Date())}</span>
        <span className="font-medium text-titlebar">{user?.name ?? user?.userName}</span>
      </div>
    </header>
  );
}
