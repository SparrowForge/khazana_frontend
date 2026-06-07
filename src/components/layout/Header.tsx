"use client";
import { useAuthStore } from "@/store/auth.store";
import { formatDate } from "@/lib/utils";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>{formatDate(new Date())}</span>
        <span className="font-medium text-gray-700">{user?.name ?? user?.userName}</span>
      </div>
    </header>
  );
}
