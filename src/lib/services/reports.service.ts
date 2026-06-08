import api from "@/lib/api";

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

const unwrap = <T>(res: { data: { data?: T } | T }): T =>
  (res.data as { data?: T }).data ?? (res.data as T);

export const reportsService = {
  sales: (from: string, to: string) =>
    api.get<{ data: SalesReportRow[] } | SalesReportRow[]>(`/reports/sales?from=${from}&to=${to}`).then(unwrap<SalesReportRow[]>),

  stock: () =>
    api.get<{ data: StockReportRow[] } | StockReportRow[]>("/reports/stock").then(unwrap<StockReportRow[]>),

  customerStatement: (from: string, to: string, customerCode: string) =>
    api.get<{ data: CustomerStatementRow[] } | CustomerStatementRow[]>(
      `/reports/customer-statement?from=${from}&to=${to}&customerCode=${customerCode}`
    ).then(unwrap<CustomerStatementRow[]>),

  daily: (date: string) =>
    api.get<{ data: DailySummaryRow[] } | DailySummaryRow[]>(`/reports/daily?date=${date}`).then(unwrap<DailySummaryRow[]>),

  itemSales: (from: string, to: string) =>
    api.get<{ data: ItemSalesRow[] } | ItemSalesRow[]>(`/reports/item-sales?from=${from}&to=${to}`).then(unwrap<ItemSalesRow[]>),

  packet: (from: string, to: string) =>
    api.get<{ data: PacketReportRow[] } | PacketReportRow[]>(`/reports/packet?from=${from}&to=${to}`).then(unwrap<PacketReportRow[]>),
};
