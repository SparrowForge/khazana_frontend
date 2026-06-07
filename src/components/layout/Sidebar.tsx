"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Package, Users, ClipboardList,
  Layers, Settings, ChevronDown, ChevronRight, BarChart2,
  DollarSign, Warehouse, FileText, UserCog, LogOut, RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={18} /> },
  {
    label: "Sales", icon: <ShoppingCart size={18} />,
    children: [
      { label: "Cash Sales", href: "/sales/cash", icon: <DollarSign size={16} /> },
      { label: "Credit Sales", href: "/sales/credit", icon: <DollarSign size={16} /> },
      { label: "VAT Cash Sales", href: "/sales/vat/cash", icon: <DollarSign size={16} /> },
      { label: "VAT Credit Sales", href: "/sales/vat/credit", icon: <DollarSign size={16} /> },
      { label: "Sales List", href: "/sales", icon: <FileText size={16} /> },
    ],
  },
  {
    label: "NC Adjustment", icon: <RefreshCw size={18} />,
    children: [
      { label: "New NC", href: "/nc-adjustment", icon: <FileText size={16} /> },
      { label: "NC List", href: "/nc-adjustment/list", icon: <ClipboardList size={16} /> },
    ],
  },
  {
    label: "Assortment", icon: <Layers size={18} />,
    children: [
      { label: "New Assortment", href: "/assortment", icon: <FileText size={16} /> },
      { label: "Assortment List", href: "/assortment/list", icon: <ClipboardList size={16} /> },
    ],
  },
  {
    label: "Inventory", icon: <Warehouse size={18} />,
    children: [
      { label: "Items", href: "/items", icon: <Package size={16} /> },
      { label: "Categories", href: "/items/categories", icon: <Layers size={16} /> },
      { label: "Stock View", href: "/inventory", icon: <BarChart2 size={16} /> },
      { label: "Stock Receive", href: "/inventory/receive", icon: <FileText size={16} /> },
      { label: "Stock Issue", href: "/inventory/issue", icon: <FileText size={16} /> },
      { label: "Stock Transfer", href: "/inventory/transfer", icon: <FileText size={16} /> },
      { label: "Stock Adjustment", href: "/inventory/adjustment", icon: <RefreshCw size={16} /> },
    ],
  },
  {
    label: "Packets", icon: <Package size={18} />,
    children: [
      { label: "Packet Info", href: "/packets", icon: <Package size={16} /> },
      { label: "Packet Receive", href: "/packets/receive", icon: <FileText size={16} /> },
      { label: "Packet Issue", href: "/packets/issue", icon: <FileText size={16} /> },
      { label: "Packet Stock", href: "/packets/stock", icon: <BarChart2 size={16} /> },
    ],
  },
  {
    label: "Customers", icon: <Users size={18} />,
    children: [
      { label: "Customer List", href: "/customers", icon: <Users size={16} /> },
      { label: "Customer Payments", href: "/customers/payments", icon: <DollarSign size={16} /> },
    ],
  },
  {
    label: "Pricing", icon: <DollarSign size={18} />,
    children: [
      { label: "Price Setup", href: "/prices", icon: <DollarSign size={16} /> },
      { label: "Cost Price Setup", href: "/cost-prices", icon: <DollarSign size={16} /> },
    ],
  },
  {
    label: "Orders", icon: <ClipboardList size={18} />,
    children: [
      { label: "Orders", href: "/orders", icon: <ClipboardList size={16} /> },
      { label: "VAT Orders", href: "/orders/vat", icon: <ClipboardList size={16} /> },
    ],
  },
  {
    label: "Finance", icon: <DollarSign size={18} />,
    children: [
      { label: "Money Receive", href: "/finance/money-receive", icon: <DollarSign size={16} /> },
      { label: "Cash Purchase", href: "/finance/cash-purchase", icon: <FileText size={16} /> },
    ],
  },
  {
    label: "Reports", icon: <BarChart2 size={18} />,
    children: [
      { label: "Sales Report", href: "/reports/sales", icon: <BarChart2 size={16} /> },
      { label: "Stock Report", href: "/reports/stock", icon: <BarChart2 size={16} /> },
      { label: "Customer Statement", href: "/reports/customer-statement", icon: <FileText size={16} /> },
      { label: "Daily Summary", href: "/reports/daily", icon: <FileText size={16} /> },
      { label: "Item-wise Sales", href: "/reports/item-sales", icon: <FileText size={16} /> },
      { label: "Packet Analysis", href: "/reports/packet", icon: <FileText size={16} /> },
    ],
  },
  {
    label: "Administration", icon: <UserCog size={18} />,
    children: [
      { label: "Users", href: "/admin/users", icon: <Users size={16} /> },
      { label: "Roles", href: "/admin/roles", icon: <UserCog size={16} /> },
      { label: "Permissions", href: "/admin/permissions", icon: <Settings size={16} /> },
      { label: "Branches", href: "/admin/branches", icon: <Warehouse size={16} /> },
      { label: "Audit Log", href: "/admin/audit-log", icon: <ClipboardList size={16} /> },
      { label: "System Settings", href: "/admin/settings", icon: <Settings size={16} /> },
    ],
  },
];

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

  return (
    <aside className="h-screen w-60 bg-slate-800 flex flex-col overflow-y-auto shrink-0">
      <div className="px-4 py-4 border-b border-slate-700">
        <h1 className="text-white font-bold text-lg">Khazana POS</h1>
        <p className="text-slate-400 text-xs mt-0.5">{user?.branch?.branchName ?? "Branch"}</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
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
