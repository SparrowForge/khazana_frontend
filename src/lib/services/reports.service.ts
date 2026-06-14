import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface SalesReportRow {
  id: number;
  invNo?: string;
  date?: string;
  customerName?: string;
  totalAmount?: number;
  discount?: number;
  netAmount?: number;
  saleType?: string;
}

export interface StockReportRow {
  id: number;
  itemCode: string;
  itemName?: string;
  uom?: string;
  quantity: number;
  unitCost?: number;
  totalValue?: number;
}

export interface CustomerStatementRow {
  date?: string;
  description?: string;
  debit?: number;
  credit?: number;
  balance?: number;
}

export interface DailySummaryRow {
  category?: string;
  amount?: number;
}

export interface ItemSalesRow {
  itemCode?: string;
  itemName?: string;
  quantity?: number;
  totalAmount?: number;
}

export interface PacketReportRow {
  packetCode?: string;
  packetName?: string;
  received?: number;
  issued?: number;
  balance?: number;
}


export const reportsService = {
  sales: (from: string, to: string) =>
    api.get<{ data: SalesReportRow[] } | SalesReportRow[]>(`/reports/sales?from=${from}&to=${to}`).then(unwrapList<SalesReportRow>),

  stock: () =>
    api.get<{ data: StockReportRow[] } | StockReportRow[]>("/reports/stock").then(unwrapList<StockReportRow>),

  customerStatement: (from: string, to: string, customerCode: string) =>
    api.get<{ data: CustomerStatementRow[] } | CustomerStatementRow[]>(
      `/reports/customer-statement?from=${from}&to=${to}&customerCode=${customerCode}`
    ).then(unwrapList<CustomerStatementRow>),

  daily: (date: string) =>
    api.get<{ data: DailySummaryRow[] } | DailySummaryRow[]>(`/reports/daily?date=${date}`).then(unwrapList<DailySummaryRow>),

  itemSales: (from: string, to: string) =>
    api.get<{ data: ItemSalesRow[] } | ItemSalesRow[]>(`/reports/item-sales?from=${from}&to=${to}`).then(unwrapList<ItemSalesRow>),

  packet: (from: string, to: string) =>
    api.get<{ data: PacketReportRow[] } | PacketReportRow[]>(`/reports/packet?from=${from}&to=${to}`).then(unwrapList<PacketReportRow>),
};
