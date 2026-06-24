import {
  LayoutDashboard, ShoppingCart, Package, Users, ClipboardList,
  Layers, Settings, BarChart2, DollarSign, Warehouse, FileText,
  UserCog, RefreshCw, Receipt,
} from "lucide-react";

/**
 * Frontend nav registry (hybrid model).
 *
 * The DB `Menu` table is the source of truth for WHICH top-level groups appear,
 * their order, label and visibility (via permissions). This registry — keyed by
 * each top-level menu's `controlName` — supplies what the DB cannot cleanly hold:
 * the lucide icon, and the leaf links (route + label) with the existing
 * permission `controlName` that gates each one. Leaf `controlName`s reference the
 * same permission rows used elsewhere, so RBAC is unchanged.
 */
export interface NavLink {
  label: string;
  route: string;
  icon: React.ReactNode;
  /** Permission controlName gating this link; defaults to the group's controlName. */
  controlName?: string;
}

export interface NavMeta {
  icon: React.ReactNode;
  /** Direct top-level link (no children). */
  route?: string;
  /** Child links rendered under an expandable group. */
  links?: NavLink[];
}

export const NAV_REGISTRY: Record<string, NavMeta> = {
  Dashboard: { icon: <LayoutDashboard size={18} />, route: "/" },

  POS: {
    icon: <Receipt size={18} />,
    links: [
      { label: "POS Terminal", route: "/pos", icon: <ShoppingCart size={16} />, controlName: "POSTerminal" },
      { label: "POS Sales", route: "/pos/sales", icon: <FileText size={16} />, controlName: "POSSales" },
    ],
  },

  Sales: {
    icon: <ShoppingCart size={18} />,
    links: [
      { label: "Cash Sales", route: "/sales/cash", icon: <DollarSign size={16} />, controlName: "CashSales" },
      { label: "Credit Sales", route: "/sales/credit", icon: <DollarSign size={16} />, controlName: "CreditSales" },
      { label: "VAT Cash Sales", route: "/sales/vat/cash", icon: <DollarSign size={16} />, controlName: "VatCashSales" },
      { label: "VAT Credit Sales", route: "/sales/vat/credit", icon: <DollarSign size={16} />, controlName: "VatCreditSales" },
      { label: "Sales List", route: "/sales", icon: <FileText size={16} />, controlName: "Sales" },
    ],
  },

  NCAdjustment: {
    icon: <RefreshCw size={18} />,
    links: [
      { label: "New NC", route: "/nc-adjustment", icon: <FileText size={16} /> },
      { label: "NC List", route: "/nc-adjustment/list", icon: <ClipboardList size={16} /> },
    ],
  },

  Assortment: {
    icon: <Layers size={18} />,
    links: [
      { label: "New Assortment", route: "/assortment", icon: <FileText size={16} /> },
      { label: "Assortment List", route: "/assortment/list", icon: <ClipboardList size={16} /> },
    ],
  },

  Inventory: {
    icon: <Warehouse size={18} />,
    links: [
      { label: "Categories", route: "/inventory/categories", icon: <Layers size={16} />, controlName: "Items" },
      { label: "Items", route: "/inventory/items", icon: <Package size={16} />, controlName: "Items" },
      { label: "Stock View", route: "/inventory", icon: <BarChart2 size={16} />, controlName: "StockView" },
      { label: "Stock Receive", route: "/inventory/receive", icon: <FileText size={16} />, controlName: "StockReceive" },
      { label: "Stock Issue", route: "/inventory/issue", icon: <FileText size={16} />, controlName: "StockIssue" },
      { label: "Stock Transfer", route: "/inventory/transfer", icon: <FileText size={16} />, controlName: "StockTransfer" },
      { label: "Stock Adjustment", route: "/inventory/adjustment", icon: <RefreshCw size={16} />, controlName: "StockAdjustment" },
    ],
  },

  Packets: {
    icon: <Package size={18} />,
    links: [
      { label: "Packet Info", route: "/packets", icon: <Package size={16} /> },
      { label: "Packet Receive", route: "/packets/receive", icon: <FileText size={16} /> },
      { label: "Packet Issue", route: "/packets/issue", icon: <FileText size={16} /> },
      { label: "Packet Stock", route: "/packets/stock", icon: <BarChart2 size={16} /> },
    ],
  },

  Customers: {
    icon: <Users size={18} />,
    links: [
      { label: "Customer List", route: "/customers", icon: <Users size={16} /> },
      { label: "Customer Payments", route: "/customers/payments", icon: <DollarSign size={16} /> },
    ],
  },

  Pricing: {
    icon: <DollarSign size={18} />,
    links: [
      { label: "Price Setup", route: "/prices", icon: <DollarSign size={16} /> },
      { label: "Cost Price Setup", route: "/cost-prices", icon: <DollarSign size={16} /> },
    ],
  },

  Orders: {
    icon: <ClipboardList size={18} />,
    links: [
      { label: "Orders", route: "/orders", icon: <ClipboardList size={16} /> },
      { label: "VAT Orders", route: "/orders/vat", icon: <ClipboardList size={16} /> },
    ],
  },

  Finance: {
    icon: <DollarSign size={18} />,
    links: [
      { label: "Money Receive", route: "/finance/money-receive", icon: <DollarSign size={16} /> },
      { label: "Cash Purchase", route: "/finance/cash-purchase", icon: <FileText size={16} /> },
    ],
  },

  Reports: {
    icon: <BarChart2 size={18} />,
    links: [
      { label: "Sales Report", route: "/reports/sales", icon: <BarChart2 size={16} /> },
      { label: "Stock Report", route: "/reports/stock", icon: <BarChart2 size={16} /> },
      { label: "Customer Statement", route: "/reports/customer-statement", icon: <FileText size={16} /> },
      { label: "Daily Summary", route: "/reports/daily", icon: <FileText size={16} /> },
      { label: "Item-wise Sales", route: "/reports/item-sales", icon: <FileText size={16} /> },
      { label: "Packet Analysis", route: "/reports/packet", icon: <FileText size={16} /> },
    ],
  },

  Admin: {
    icon: <UserCog size={18} />,
    links: [
      { label: "Users", route: "/admin/users", icon: <Users size={16} />, controlName: "Users" },
      { label: "Roles", route: "/admin/roles", icon: <UserCog size={16} />, controlName: "RolesPermissions" },
      { label: "Permissions", route: "/admin/permissions", icon: <Settings size={16} />, controlName: "RolesPermissions" },
      { label: "User Menu Permission", route: "/admin/user-permissions", icon: <UserCog size={16} />, controlName: "UserRolePermission" },
      { label: "User Role Assignment", route: "/admin/user-role-permissions", icon: <UserCog size={16} />, controlName: "UserRolePermission" },
      { label: "Branches", route: "/admin/branches", icon: <Warehouse size={16} />, controlName: "Admin" },
      { label: "Audit Log", route: "/admin/audit-log", icon: <ClipboardList size={16} />, controlName: "Admin" },
      { label: "System Settings", route: "/admin/settings", icon: <Settings size={16} />, controlName: "Admin" },
    ],
  },
};
