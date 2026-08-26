"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { ShoppingCart, DollarSign, Package, Users, TrendingUp, RefreshCw, Building2 } from "lucide-react";
import Card from "@/components/ui/Card";
import { useAuthStore } from "@/store/auth.store";
import { usePermissions } from "@/hooks/usePermissions";
import { isFactoryBranch } from "@/lib/branch";

interface BranchSales {
  branchId: string;
  branchCode?: string | null;
  branchName?: string | null;
  todaySales: number;
  todayRevenue: number;
}

interface DashboardStats {
  todaySales?: number;
  todayRevenue?: number;
  totalItems?: number;
  totalCustomers?: number;
  lowStockItems?: number;
  pendingOrders?: number;
  branches?: BranchSales[];
}

/** Quick Actions. `controlName` mirrors the leaf's entry in navRegistry, so a
 *  tile is only offered when the sidebar would offer the page too. */
interface QuickAction {
  label: string;
  href: string;
  controlName: string;
}

/** The factory's own working day: issue stock to the outlets, book production,
 *  ring up a sale, raise a credit invoice, then read the day back. */
const FACTORY_QUICK_ACTIONS: QuickAction[] = [
  { label: "Stock Issue",          href: "/inventory/issue",      controlName: "StockIssue" },
  { label: "Production Entry",     href: "/inventory/production", controlName: "ProductionEntry" },
  { label: "POS Terminal Sale",    href: "/pos",                  controlName: "POSTerminal" },
  { label: "Credit Sale",          href: "/sales/credit",         controlName: "CreditSales" },
  // The Sales Report opens on today's date, so it lands as today's figures.
  { label: "Today's Sales Report", href: "/reports/sales",        controlName: "SalesReport" },
];

/** An outlet receives rather than produces, so its shortcuts stay as they were. */
const BRANCH_QUICK_ACTIONS: QuickAction[] = [
  { label: "New Cash Sale",   href: "/sales/cash",       controlName: "CashSales" },
  { label: "New Credit Sale", href: "/sales/credit",     controlName: "CreditSales" },
  { label: "Stock Receive",   href: "/inventory/receive", controlName: "StockReceive" },
  { label: "New Order",       href: "/orders",           controlName: "OrdersList" },
];

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  href: string;
}

function StatCard({ title, value, icon, color, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="bg-white rounded-lg border border-sage-300 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-primary-300 transition-shadow cursor-pointer"
    >
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  // Production Entry is factory-only (the page itself is guarded), so the
  // factory set is offered only to a factory session — same branch test the
  // sidebar and the route guard use.
  const user = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const quickActions = (isFactoryBranch(user) ? FACTORY_QUICK_ACTIONS : BRANCH_QUICK_ACTIONS)
    .filter((a) => can(a.controlName));

  useEffect(() => {
    api.get("/dashboard")
      .then((res) => setStats(res.data))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      title: "Today's Sales",
      value: loading ? "..." : String(stats.todaySales ?? 0),
      icon: <ShoppingCart size={22} className="text-primary-700" />,
      color: "bg-sage-100",
      href: "/reports/sales",
    },
    {
      title: "Today's Revenue",
      value: loading ? "..." : `৳ ${formatCurrency(stats.todayRevenue ?? 0)}`,
      icon: <DollarSign size={22} className="text-green-600" />,
      color: "bg-green-50",
      href: "/reports/daily",
    },
    {
      title: "Total Items",
      value: loading ? "..." : String(stats.totalItems ?? 0),
      icon: <Package size={22} className="text-purple-600" />,
      color: "bg-purple-50",
      href: "/inventory/items",
    },
    {
      title: "Total Customers",
      value: loading ? "..." : String(stats.totalCustomers ?? 0),
      icon: <Users size={22} className="text-orange-600" />,
      color: "bg-orange-50",
      href: "/customers",
    },
    {
      title: "Low Stock Items",
      value: loading ? "..." : String(stats.lowStockItems ?? 0),
      icon: <TrendingUp size={22} className="text-red-600" />,
      color: "bg-red-50",
      href: "/reports/stock",
    },
    {
      title: "Pending Orders",
      value: loading ? "..." : String(stats.pendingOrders ?? 0),
      icon: <RefreshCw size={22} className="text-yellow-600" />,
      color: "bg-yellow-50",
      href: "/orders",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* Per-branch sales — one card per branch the user is assigned to */}
      {!loading && (stats.branches?.length ?? 0) > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Today&apos;s Sales by Branch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {stats.branches!.map((b) => (
              <Link
                key={b.branchId}
                href="/reports/sales"
                className="block bg-white rounded-lg border border-sage-300 shadow-sm p-5 hover:shadow-md hover:border-primary-300 transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={18} className="text-primary-700" />
                  <p className="font-semibold text-gray-800">{b.branchName ?? b.branchCode ?? "Branch"}</p>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Sales</p>
                    <p className="text-xl font-bold text-gray-800">{b.todaySales}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Revenue</p>
                    <p className="text-xl font-bold text-green-600">৳ {formatCurrency(b.todayRevenue)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <Card title="Recent Sales">
          <p className="text-sm text-gray-400">Recent sales will appear here.</p>
        </Card>
        <Card title="Quick Actions">
          {quickActions.length ? (
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="block text-center text-sm font-medium text-primary-800 bg-primary-50 hover:bg-primary-100 rounded-md px-3 py-2 transition-colors"
                >
                  {a.label}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No quick actions available for your permissions.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
