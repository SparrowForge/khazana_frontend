"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import Sidebar from "./Sidebar";

// Order matters: more specific paths must come before their prefixes
const ROUTE_CONTROL_MAP: Array<[string, string]> = [
  ["/sales/vat/cash", "VatCashSales"],
  ["/sales/vat/credit", "VatCreditSales"],
  ["/sales/cash", "CashSales"],
  ["/sales/credit", "CreditSales"],
  ["/sales", "Sales"],
  ["/nc-adjustment", "NCAdjustment"],
  ["/assortment", "Assortment"],
  ["/inventory/items", "Items"],
  ["/inventory/receive", "StockReceive"],
  ["/inventory/issue", "StockIssue"],
  ["/inventory/transfer", "StockTransfer"],
  ["/inventory/adjustment", "StockAdjustment"],
  ["/inventory", "StockView"],
  ["/packets", "Packets"],
  ["/customers", "Customers"],
  ["/prices", "Pricing"],
  ["/cost-prices", "Pricing"],
  ["/orders", "Orders"],
  ["/finance", "Finance"],
  ["/reports", "Reports"],
  ["/admin/users", "Users"],
  ["/admin/roles", "RolesPermissions"],
  ["/admin/permissions", "RolesPermissions"],
  ["/admin/user-permissions", "UserRolePermission"],
  ["/admin", "Admin"],
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    const match = ROUTE_CONTROL_MAP.find(
      ([route]) => pathname === route || pathname.startsWith(route + "/")
    );
    if (match) {
      const controlName = match[1];
      const perm = user?.permissions?.find((p) => p.controlName === controlName);
      if (!perm || perm.isEnable !== "Y") {
        router.push("/");
      }
    }
  }, [hydrated, isAuthenticated, pathname, router, user]);

  if (!hydrated || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
