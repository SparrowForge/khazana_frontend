import api from "@/lib/api";

export interface SalesHistoryItem {
  serialNo: number;
  date: string;
  invoiceNo: string;
  clientName: string;
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
  /** Customer on the invoice — blank on running (POS) counter sales, which
   *  carry no customer at all. Repeats down an invoice's lines like invoiceNo. */
  clientName: string;
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

/** The payment columns this sheet reports, and the values the method filter
 *  accepts. Keep in step with ReportsService.PAY_COLUMNS. */
export const PAY_METHOD_FILTERS = [
  { value: "", label: "All payment methods" },
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "brac", label: "BRAC (card)" },
  { value: "ucb", label: "UCB (card)" },
  { value: "city", label: "City (card)" },
  { value: "ebl", label: "EBL (card)" },
  { value: "fpanda", label: "Foodpanda" },
  { value: "pathao", label: "Pathao" },
  { value: "foodi", label: "Foodi" },
  { value: "credit", label: "Credit" },
];

/** `payMethod` filters to the invoices that put money in that column. A split
 *  bill appears under every method it was settled with, showing that method's
 *  share — which is the honest answer to "what came in on card". */
export const fetchSalesHistory = (
  fromDate: string,
  toDate: string,
  branchId?: string,
  payMethod?: string,
): Promise<SalesHistoryReport> => {
  const params = new URLSearchParams();
  params.append("fromDate", fromDate);
  params.append("toDate", toDate);
  if (branchId) params.append("branchId", branchId);
  if (payMethod) params.append("payMethod", payMethod);
  return api.get(`/reports/sales-history?${params.toString()}`).then((r) => r.data);
};
