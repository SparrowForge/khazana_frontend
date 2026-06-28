"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { ShoppingCart, DollarSign, Package, Users, TrendingUp, RefreshCw, Building2 } from "lucide-react";
import Card from "@/components/ui/Card";

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

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4`}>
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

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
      icon: <ShoppingCart size={22} className="text-blue-600" />,
      color: "bg-blue-50",
    },
    {
      title: "Today's Revenue",
      value: loading ? "..." : `৳ ${formatCurrency(stats.todayRevenue ?? 0)}`,
      icon: <DollarSign size={22} className="text-green-600" />,
      color: "bg-green-50",
    },
    {
      title: "Total Items",
      value: loading ? "..." : String(stats.totalItems ?? 0),
      icon: <Package size={22} className="text-purple-600" />,
      color: "bg-purple-50",
    },
    {
      title: "Total Customers",
      value: loading ? "..." : String(stats.totalCustomers ?? 0),
      icon: <Users size={22} className="text-orange-600" />,
      color: "bg-orange-50",
    },
    {
      title: "Low Stock Items",
      value: loading ? "..." : String(stats.lowStockItems ?? 0),
      icon: <TrendingUp size={22} className="text-red-600" />,
      color: "bg-red-50",
    },
    {
      title: "Pending Orders",
      value: loading ? "..." : String(stats.pendingOrders ?? 0),
      icon: <RefreshCw size={22} className="text-yellow-600" />,
      color: "bg-yellow-50",
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
              <div key={b.branchId} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <Card title="Recent Sales">
          <p className="text-sm text-gray-400">Recent sales will appear here.</p>
        </Card>
        <Card title="Quick Actions">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "New Cash Sale", href: "/sales/cash" },
              { label: "New Credit Sale", href: "/sales/credit" },
              { label: "Stock Receive", href: "/inventory/receive" },
              { label: "New Order", href: "/orders" },
            ].map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="block text-center text-sm font-medium text-primary-800 bg-primary-50 hover:bg-primary-100 rounded-md px-3 py-2 transition-colors"
              >
                {a.label}
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
