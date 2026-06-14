"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Package, Users, ClipboardList,
  Layers, Settings, ChevronDown, ChevronRight, BarChart2,
  DollarSign, Warehouse, FileText, UserCog, LogOut, RefreshCw,
  Receipt,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import type { UserPermission } from "@/types";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  controlName?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={18} />, controlName: "Dashboard" },
  {
    label: "POS Billing", icon: <Receipt size={18} />,
    children: [
      { label: "POS Terminal", href: "/pos", icon: <ShoppingCart size={16} /> },
      { label: "POS Sales", href: "/pos/sales", icon: <FileText size={16} /> },
    ],
  },
  {
    label: "Sales", icon: <ShoppingCart size={18} />, controlName: "Sales",
    children: [
      { label: "Cash Sales", href: "/sales/cash", icon: <DollarSign size={16} />, controlName: "CashSales" },
      { label: "Credit Sales", href: "/sales/credit", icon: <DollarSign size={16} />, controlName: "CreditSales" },
      { label: "VAT Cash Sales", href: "/sales/vat/cash", icon: <DollarSign size={16} />, controlName: "VatCashSales" },
      { label: "VAT Credit Sales", href: "/sales/vat/credit", icon: <DollarSign size={16} />, controlName: "VatCreditSales" },
      { label: "Sales List", href: "/sales", icon: <FileText size={16} />, controlName: "Sales" },
    ],
  },
  {
    label: "NC Adjustment", icon: <RefreshCw size={18} />, controlName: "NCAdjustment",
    children: [
      { label: "New NC", href: "/nc-adjustment", icon: <FileText size={16} />, controlName: "NCAdjustment" },
      { label: "NC List", href: "/nc-adjustment/list", icon: <ClipboardList size={16} />, controlName: "NCAdjustment" },
    ],
  },
  {
    label: "Assortment", icon: <Layers size={18} />, controlName: "Assortment",
    children: [
      { label: "New Assortment", href: "/assortment", icon: <FileText size={16} />, controlName: "Assortment" },
      { label: "Assortment List", href: "/assortment/list", icon: <ClipboardList size={16} />, controlName: "Assortment" },
    ],
  },
  {
    label: "Inventory", icon: <Warehouse size={18} />, controlName: "Inventory",
    children: [
      { label: "Items", href: "/items", icon: <Package size={16} />, controlName: "Items" },
      { label: "Categories", href: "/items/categories", icon: <Layers size={16} />, controlName: "Items" },
      { label: "Stock View", href: "/inventory", icon: <BarChart2 size={16} />, controlName: "StockView" },
      { label: "Stock Receive", href: "/inventory/receive", icon: <FileText size={16} />, controlName: "StockReceive" },
      { label: "Stock Issue", href: "/inventory/issue", icon: <FileText size={16} />, controlName: "StockIssue" },
      { label: "Stock Transfer", href: "/inventory/transfer", icon: <FileText size={16} />, controlName: "StockTransfer" },
      { label: "Stock Adjustment", href: "/inventory/adjustment", icon: <RefreshCw size={16} />, controlName: "StockAdjustment" },
    ],
  },
  {
    label: "Packets", icon: <Package size={18} />, controlName: "Packets",
    children: [
      { label: "Packet Info", href: "/packets", icon: <Package size={16} />, controlName: "Packets" },
      { label: "Packet Receive", href: "/packets/receive", icon: <FileText size={16} />, controlName: "Packets" },
      { label: "Packet Issue", href: "/packets/issue", icon: <FileText size={16} />, controlName: "Packets" },
      { label: "Packet Stock", href: "/packets/stock", icon: <BarChart2 size={16} />, controlName: "Packets" },
    ],
  },
  {
    label: "Customers", icon: <Users size={18} />, controlName: "Customers",
    children: [
      { label: "Customer List", href: "/customers", icon: <Users size={16} />, controlName: "Customers" },
      { label: "Customer Payments", href: "/customers/payments", icon: <DollarSign size={16} />, controlName: "Customers" },
    ],
  },
  {
    label: "Pricing", icon: <DollarSign size={18} />, controlName: "Pricing",
    children: [
      { label: "Price Setup", href: "/prices", icon: <DollarSign size={16} />, controlName: "Pricing" },
      { label: "Cost Price Setup", href: "/cost-prices", icon: <DollarSign size={16} />, controlName: "Pricing" },
    ],
  },
  {
    label: "Orders", icon: <ClipboardList size={18} />, controlName: "Orders",
    children: [
      { label: "Orders", href: "/orders", icon: <ClipboardList size={16} />, controlName: "Orders" },
      { label: "VAT Orders", href: "/orders/vat", icon: <ClipboardList size={16} />, controlName: "Orders" },
    ],
  },
  {
    label: "Finance", icon: <DollarSign size={18} />, controlName: "Finance",
    children: [
      { label: "Money Receive", href: "/finance/money-receive", icon: <DollarSign size={16} />, controlName: "Finance" },
      { label: "Cash Purchase", href: "/finance/cash-purchase", icon: <FileText size={16} />, controlName: "Finance" },
    ],
  },
  {
    label: "Reports", icon: <BarChart2 size={18} />, controlName: "Reports",
    children: [
      { label: "Sales Report", href: "/reports/sales", icon: <BarChart2 size={16} />, controlName: "Reports" },
      { label: "Stock Report", href: "/reports/stock", icon: <BarChart2 size={16} />, controlName: "Reports" },
      { label: "Customer Statement", href: "/reports/customer-statement", icon: <FileText size={16} />, controlName: "Reports" },
      { label: "Daily Summary", href: "/reports/daily", icon: <FileText size={16} />, controlName: "Reports" },
      { label: "Item-wise Sales", href: "/reports/item-sales", icon: <FileText size={16} />, controlName: "Reports" },
      { label: "Packet Analysis", href: "/reports/packet", icon: <FileText size={16} />, controlName: "Reports" },
    ],
  },
  {
    label: "Administration", icon: <UserCog size={18} />, controlName: "Admin",
    children: [
      { label: "Users", href: "/admin/users", icon: <Users size={16} />, controlName: "Users" },
      { label: "Roles", href: "/admin/roles", icon: <UserCog size={16} />, controlName: "RolesPermissions" },
      { label: "Permissions", href: "/admin/permissions", icon: <Settings size={16} />, controlName: "RolesPermissions" },
      { label: "Branches", href: "/admin/branches", icon: <Warehouse size={16} />, controlName: "Admin" },
      { label: "Audit Log", href: "/admin/audit-log", icon: <ClipboardList size={16} />, controlName: "Admin" },
      { label: "System Settings", href: "/admin/settings", icon: <Settings size={16} />, controlName: "Admin" },
    ],
  },
];

function isEnabled(controlName: string, permissions: UserPermission[]): boolean {
  const perm = permissions.find((p) => p.controlName === controlName);
  return perm?.isEnable === "Y";
}

function filterNavItems(items: NavItem[], permissions: UserPermission[]): NavItem[] {
  return items.reduce<NavItem[]>((acc, item) => {
    if (item.children) {
      const visibleChildren = filterNavItems(item.children, permissions);
      const parentAllowed = !item.controlName || isEnabled(item.controlName, permissions);
      if (parentAllowed && visibleChildren.length > 0) {
        acc.push({ ...item, children: visibleChildren });
      }
    } else {
      if (!item.controlName || isEnabled(item.controlName, permissions)) {
        acc.push(item);
      }
    }
    return acc;
  }, []);
}

function NavGroup({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isChildActive = item.children?.some((c) => c.href && pathname.startsWith(c.href));
  const [open, setOpen] = useState(isChildActive ?? false);

  if (!item.children) {
    return (
      <Link
        href={item.href!}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
          pathname === item.href
            ? "bg-primary-800 text-white"
            : "text-slate-300 hover:bg-slate-700 hover:text-white"
        )}
      >
        {item.icon}
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
          isChildActive ? "text-white bg-slate-700" : "text-slate-300 hover:bg-slate-700 hover:text-white"
        )}
      >
        <span className="flex items-center gap-2">{item.icon}{item.label}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-600 pl-2">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href!}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
                pathname === child.href
                  ? "bg-primary-800 text-white"
                  : "text-slate-400 hover:bg-slate-700 hover:text-white"
              )}
            >
              {child.icon}
              <span>{child.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const visibleItems = filterNavItems(navItems, user?.permissions ?? []);

  return (
    <aside className="h-screen w-60 bg-slate-800 flex flex-col overflow-y-auto shrink-0">
      <div className="px-4 py-4 border-b border-slate-700">
        <h1 className="text-white font-bold text-lg">Khazana POS</h1>
        <p className="text-slate-400 text-xs mt-0.5">{user?.branchName ?? user?.branch?.branchName ?? "Branch"}</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {visibleItems.map((item) => (
          <NavGroup key={item.label} item={item} />
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-700">
        <p className="text-slate-300 text-sm font-medium">{user?.name ?? user?.userName}</p>
        <button
          onClick={handleLogout}
          className="mt-2 flex items-center gap-2 text-slate-400 hover:text-white text-xs transition-colors"
        >
          <LogOut size={14} /> Logout
        </button>
      </div>
    </aside>
  );
}
