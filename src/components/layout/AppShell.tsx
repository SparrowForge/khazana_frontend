"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import Sidebar from "./Sidebar";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/verify", "/verify-code"];

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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (!hydrated || isPublic) return;
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
  }, [hydrated, isAuthenticated, isPublic, pathname, router, user]);

  if (!hydrated) return null;
  if (isPublic) return <>{children}</>;
  if (!isAuthenticated) return null;

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
