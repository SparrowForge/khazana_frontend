import {
  LayoutDashboard, ShoppingCart, Package, Users, ClipboardList,
  Layers, Settings, BarChart2, DollarSign, Warehouse, FileText,
  UserCog, RefreshCw, Receipt, Landmark, Factory, Truck, Ruler,
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
  /** Hide unless the session branch is the factory. Permission alone isn't
   *  enough for these — the backend refuses them from any other branch. */
  factoryOnly?: boolean;
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

  Sales: {
    icon: <ShoppingCart size={18} />,
    links: [
      { label: "Cash Sales", route: "/pos", icon: <Receipt size={16} />, controlName: "POSTerminal" },
      { label: "Cash Sales List", route: "/pos/sales", icon: <Receipt size={16} />, controlName: "POSSales" },
      { label: "Credit Sales", route: "/sales/credit", icon: <DollarSign size={16} />, controlName: "CreditSales" },
      { label: "VAT Cash Sales", route: "/sales/vat/cash", icon: <DollarSign size={16} />, controlName: "VatCashSales" },
      { label: "VAT Credit Sales", route: "/sales/vat/credit", icon: <DollarSign size={16} />, controlName: "VatCreditSales" },
      { label: "Credit Sales List", route: "/sales", icon: <FileText size={16} />, controlName: "SalesList" },
    ],
  },

  NCAdjustment: {
    icon: <RefreshCw size={18} />,
    links: [
      { label: "New NC", route: "/nc-adjustment", icon: <FileText size={16} />, controlName: "NCNew" },
      { label: "NC List", route: "/nc-adjustment/list", icon: <ClipboardList size={16} />, controlName: "NCList" },
    ],
  },

  Assortment: {
    icon: <Layers size={18} />,
    links: [
      { label: "New Assortment", route: "/assortment", icon: <FileText size={16} />, controlName: "AssortmentNew" },
      { label: "Assortment List", route: "/assortment/list", icon: <ClipboardList size={16} />, controlName: "AssortmentList" },
    ],
  },

  Inventory: {
    icon: <Warehouse size={18} />,
    links: [
      { label: "Categories", route: "/inventory/categories", icon: <Layers size={16} />, controlName: "Categories" },
      { label: "UOM", route: "/inventory/uom", icon: <Ruler size={16} />, controlName: "UOM" },
      { label: "Items", route: "/inventory/items", icon: <Package size={16} />, controlName: "Items" },
      { label: "Stock View", route: "/inventory", icon: <BarChart2 size={16} />, controlName: "StockView" },
      { label: "Stock Receive", route: "/inventory/receive", icon: <FileText size={16} />, controlName: "StockReceive" },
      { label: "Stock Issue", route: "/inventory/issue", icon: <FileText size={16} />, controlName: "StockIssue" },
      // The same entry form on a screen of its own, for operators who do nothing
      // but write issues; Stock Issue above keeps the list, edit and delete.
      { label: "Item Issue", route: "/inventory/item-issue", icon: <Truck size={16} />, controlName: "ItemIssue" },
      { label: "Stock Transfer", route: "/inventory/transfer", icon: <FileText size={16} />, controlName: "StockTransfer" },
      { label: "Stock Adjustment", route: "/inventory/adjustment", icon: <RefreshCw size={16} />, controlName: "StockAdjustment" },
      { label: "Production Entry", route: "/inventory/production", icon: <Factory size={16} />, controlName: "ProductionEntry", factoryOnly: true },
    ],
  },

  Packets: {
    icon: <Package size={18} />,
    links: [
      { label: "Packet Info", route: "/packets", icon: <Package size={16} />, controlName: "PacketInfo" },
      { label: "Packet Receive", route: "/packets/receive", icon: <FileText size={16} />, controlName: "PacketReceive" },
      { label: "Packet Issue", route: "/packets/issue", icon: <FileText size={16} />, controlName: "PacketIssue" },
      { label: "Packet Stock", route: "/packets/stock", icon: <BarChart2 size={16} />, controlName: "PacketStock" },
    ],
  },

  Customers: {
    icon: <Users size={18} />,
    links: [
      { label: "Customer List", route: "/customers", icon: <Users size={16} />, controlName: "CustomerList" },
      { label: "Customer Money Receipt", route: "/customers/payments", icon: <DollarSign size={16} />, controlName: "CustomerPayments" },
    ],
  },

  Pricing: {
    icon: <DollarSign size={18} />,
    links: [
      { label: "Price Setup", route: "/prices", icon: <DollarSign size={16} />, controlName: "PriceSetup" },
      { label: "Cost Price Setup", route: "/cost-prices", icon: <DollarSign size={16} />, controlName: "CostPriceSetup" },
    ],
  },

  Orders: {
    icon: <ClipboardList size={18} />,
    links: [
      { label: "Orders", route: "/orders", icon: <ClipboardList size={16} />, controlName: "OrdersList" },
      { label: "VAT Orders", route: "/orders/vat", icon: <ClipboardList size={16} />, controlName: "VatOrders" },
      { label: "Demand Order", route: "/orders/demand", icon: <FileText size={16} />, controlName: "DemandOrders" },
    ],
  },

  Finance: {
    icon: <DollarSign size={18} />,
    links: [
      { label: "Cash Purchase", route: "/finance/cash-purchase", icon: <FileText size={16} />, controlName: "CashPurchase" },
    ],
  },

  Reports: {
    icon: <BarChart2 size={18} />,
    links: [
      { label: "Sales Report", route: "/reports/sales", icon: <BarChart2 size={16} />, controlName: "SalesReport" },
      { label: "Sales History Summary", route: "/reports/sales-history", icon: <BarChart2 size={16} />, controlName: "SalesHistorySummary" },
      { label: "Stock Report", route: "/reports/stock", icon: <BarChart2 size={16} />, controlName: "StockReport" },
      { label: "Stock Analysis", route: "/reports/stock-analysis", icon: <BarChart2 size={16} />, controlName: "StockAnalysis" },
      { label: "Item Receive Report", route: "/reports/item-receive", icon: <FileText size={16} />, controlName: "ItemReceiveReport" },
      { label: "Item Reject Report", route: "/reports/item-reject", icon: <FileText size={16} />, controlName: "ItemRejectReport" },
      { label: "Reject Report(POS)", route: "/reports/reject-pos", icon: <FileText size={16} />, controlName: "RejectReportPOS" },
      { label: "Excess Report(POS)", route: "/reports/excess-pos", icon: <FileText size={16} />, controlName: "ExcessReportPOS" },
      { label: "Short Report(POS)", route: "/reports/short-pos", icon: <FileText size={16} />, controlName: "ShortReportPOS" },
      { label: "NC Report", route: "/reports/nc", icon: <FileText size={16} />, controlName: "NCReport" },
      { label: "Discount Summary", route: "/reports/discount-summary", icon: <FileText size={16} />, controlName: "DiscountSummary" },
      { label: "Customer Statement", route: "/reports/customer-statement", icon: <FileText size={16} />, controlName: "CustomerStatement" },
      { label: "Daily Summary", route: "/reports/daily", icon: <FileText size={16} />, controlName: "DailySummary" },
      { label: "Daily Final Report", route: "/reports/daily-final", icon: <FileText size={16} />, controlName: "DailyFinalReport" },
      { label: "Item-wise Sales", route: "/reports/item-sales", icon: <FileText size={16} />, controlName: "ItemSales" },
      { label: "Packet Analysis", route: "/reports/packet", icon: <FileText size={16} />, controlName: "PacketAnalysis" },
    ],
  },

  // Every leaf here is factoryOnly, so the whole group disappears from the
  // sidebar for any non-factory session (buildNav drops empty groups).
  FactoryReport: {
    icon: <Factory size={18} />,
    links: [
      { label: "Production & Delivery Report", route: "/factory/production-delivery", icon: <BarChart2 size={16} />, controlName: "ProductionDeliveryReport", factoryOnly: true },
      { label: "Branchwise Delivery Report", route: "/factory/branchwise-delivery", icon: <BarChart2 size={16} />, controlName: "BranchwiseDeliveryReport", factoryOnly: true },
      // Same report as Reports > Discount Summary, under the factory's own
      // menu and permission. The page is a re-export, not a copy.
      { label: "Discount Log Report", route: "/factory/discount-log", icon: <FileText size={16} />, controlName: "DiscountLogReport", factoryOnly: true },
      { label: "Demand Report", route: "/factory/demand-report", icon: <FileText size={16} />, controlName: "DemandReport", factoryOnly: true },
      // Same report as Reports > Sales History Summary, under the factory's own
      // menu and permission. The page is a re-export, not a copy.
      { label: "Sales History Report", route: "/factory/sales-history", icon: <BarChart2 size={16} />, controlName: "SalesHistoryReport", factoryOnly: true },
      // Lives under Factory Report rather than Inventory: it is a despatch
      // document, not a stock movement — a challan never touches Inventory. The
      // route is unchanged, so existing links and bookmarks still resolve.
      { label: "Challan Entry", route: "/inventory/vehicle-challan", icon: <Truck size={16} />, controlName: "VehicleChallan", factoryOnly: true },
    ],
  },

  Admin: {
    icon: <UserCog size={18} />,
    links: [
      { label: "Users", route: "/admin/users", icon: <Users size={16} />, controlName: "Users" },
      { label: "Roles", route: "/admin/roles", icon: <UserCog size={16} />, controlName: "Roles" },
      { label: "Permissions", route: "/admin/permissions", icon: <Settings size={16} />, controlName: "Permissions" },
      { label: "User Menu Permission", route: "/admin/user-permissions", icon: <UserCog size={16} />, controlName: "UserMenuPermission" },
      { label: "User Role Assignment", route: "/admin/user-role-permissions", icon: <UserCog size={16} />, controlName: "UserRoleAssignment" },
      { label: "Branches", route: "/admin/branches", icon: <Warehouse size={16} />, controlName: "Branches" },
      { label: "Banks", route: "/admin/banks", icon: <Landmark size={16} />, controlName: "Bank" },
      { label: "Audit Log", route: "/admin/audit-log", icon: <ClipboardList size={16} />, controlName: "AuditLog" },
      { label: "System Settings", route: "/admin/settings", icon: <Settings size={16} />, controlName: "SystemSettings" },
    ],
  },
};
