"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { isFactoryBranch } from "@/lib/branch";
import Sidebar from "./Sidebar";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/verify", "/verify-code"];

// Per-page route → permission controlName. More specific prefixes MUST come
// before their parent (matched top-down via startsWith). Each entry mirrors a
// leaf `controlName` in navRegistry so the sidebar link and the route guard
// agree. The broad group fallbacks (e.g. "/admin" → "Admin") stay last to cover
// index/detail routes that aren't individually listed.
const ROUTE_CONTROL_MAP: Array<[string, string]> = [
  ["/sales/vat/cash", "VatCashSales"],
  ["/sales/vat/credit", "VatCreditSales"],
  ["/sales/cash", "CashSales"],
  ["/sales/credit", "CreditSales"],
  ["/sales", "SalesList"],
  ["/pos/sales", "POSSales"],
  ["/pos", "POSTerminal"],
  ["/nc-adjustment/list", "NCList"],
  // Viewing/printing an NC is a read of an existing record, so it rides on list
  // access rather than the create page's permission.
  ["/nc-adjustment/invoice", "NCList"],
  ["/nc-adjustment", "NCNew"],
  ["/assortment/list", "AssortmentList"],
  ["/assortment", "AssortmentNew"],
  ["/inventory/categories", "Categories"],
  ["/inventory/items", "Items"],
  ["/inventory/receive", "StockReceive"],
  ["/inventory/issue", "StockIssue"],
  ["/inventory/transfer", "StockTransfer"],
  ["/inventory/adjustment", "StockAdjustment"],
  ["/inventory/production", "ProductionEntry"],
  ["/inventory", "StockView"],
  ["/packets/receive", "PacketReceive"],
  ["/packets/issue", "PacketIssue"],
  ["/packets/stock", "PacketStock"],
  ["/packets", "PacketInfo"],
  ["/customers/payments", "CustomerPayments"],
  ["/customers", "CustomerList"],
  ["/prices", "PriceSetup"],
  ["/cost-prices", "CostPriceSetup"],
  ["/orders/vat", "VatOrders"],
  ["/orders/demand", "DemandOrders"],
  ["/orders", "OrdersList"],
  ["/finance/cash-purchase", "CashPurchase"],
  ["/finance", "Finance"],
  ["/reports/sales", "SalesReport"],
  ["/reports/item-receive", "ItemReceiveReport"],
  ["/reports/item-reject", "ItemRejectReport"],
  ["/reports/nc", "NCReport"],
  ["/reports/discount-summary", "DiscountSummary"],
  ["/reports/stock-analysis", "StockAnalysis"],
  ["/reports/stock", "StockReport"],
  ["/reports/customer-statement", "CustomerStatement"],
  ["/reports/daily-final", "DailyFinalReport"],
  ["/reports/daily", "DailySummary"],
  ["/reports/item-sales", "ItemSales"],
  ["/reports/packet", "PacketAnalysis"],
  ["/reports", "Reports"],
  ["/factory/production-delivery", "ProductionDeliveryReport"],
  ["/factory/branchwise-delivery", "BranchwiseDeliveryReport"],
  ["/factory/discount-log", "DiscountLogReport"],
  ["/factory/demand-report", "DemandReport"],
  ["/admin/users", "Users"],
  ["/admin/roles", "Roles"],
  ["/admin/permissions", "Permissions"],
  ["/admin/user-role-permissions", "UserRoleAssignment"],
  ["/admin/user-permissions", "UserMenuPermission"],
  ["/admin/branches", "Branches"],
  ["/admin/banks", "Bank"],
  ["/admin/audit-log", "AuditLog"],
  ["/admin/settings", "SystemSettings"],
  ["/admin", "Admin"],
];

// Routes that exist only for the factory branch. Permission is necessary but
// not sufficient — the matching backend endpoints reject a non-factory session
// branch outright, so bounce rather than render a page that can only 403.
const FACTORY_ONLY_ROUTES = ["/inventory/production", "/factory"];

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
    const factoryOnly = FACTORY_ONLY_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );
    if (factoryOnly && !isFactoryBranch(user)) {
      router.push("/");
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
