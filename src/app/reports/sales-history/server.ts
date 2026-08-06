import api from "@/lib/api";

export interface SalesHistoryItem {
  serialNo: number;
  date: string;
  invoiceNo: string;
  itemName: string;
  uom: string;
  qty: number;
  price: number;
  amount: number;
  discount: number;
  vat: number;
  totalAmount: number;
  cash: number;
  bkash: number;
  nagad: number;
  brac: number;
  ucb: number;
  city: number;
  ebl: number;
  fpanda: number;
  pathao: number;
  foodi: number;
  credit: number;
}

/** One sold item. An invoice contributes one row per line, so its number and
 *  date repeat down the group — the sheet prints them only on the first row. */
export interface SalesHistoryRow {
  date: string;
  invoiceNo: string;
  itemName: string;
  /** Unit the qty is in (KG / Pcs), shown beside it the way the sheet reads. */
  uom: string;
  qty: number;
  price: number;
  amount: number;
  discount: number;
  vat: number;
  totalAmount: number;
  cash: number;
  bkash: number;
  nagad: number;
  brac: number;
  ucb: number;
  city: number;
  ebl: number;
  fpanda: number;
  pathao: number;
  foodi: number;
  credit: number;
}

export interface DailySubTotal {
  date: string;
  qty: number;
  amount: number;
  discount: number;
  vat: number;
  totalAmount: number;
  cash: number;
  bkash: number;
  nagad: number;
  brac: number;
  ucb: number;
  city: number;
  ebl: number;
  fpanda: number;
  pathao: number;
  foodi: number;
  credit: number;
}

export interface SalesHistoryReport {
  branchName?: string;
  branchAddress?: string;
  fromDate: string;
  toDate: string;
  items: SalesHistoryRow[];
  dailySubTotals: DailySubTotal[];
}

export const fetchSalesHistory = (fromDate: string, toDate: string, branchId?: string): Promise<SalesHistoryReport> => {
  const params = new URLSearchParams();
  params.append("fromDate", fromDate);
  params.append("toDate", toDate);
  if (branchId) params.append("branchId", branchId);
  return api.get(`/reports/sales-history?${params.toString()}`).then((r) => r.data);
};
