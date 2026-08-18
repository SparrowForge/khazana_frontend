import api from "@/lib/api";

export interface StockAnalysisRow {
  sl: number;
  itemCode: string;
  itemName: string;
  uom: string;
  rate: number;
  openStock: number;
  /** Factory-only manufactured output (Production table); 0 at every other branch. */
  production: number;
  gReceive: number;
  totalStock: number;
  salesQty: number;
  salesAmt: number;
  assorted: number;
  nc: number;
  reject: number;
  issueQty: number;
  short: number;
  excess: number;
  closing: number;
}

export type StockAnalysisTotals = Omit<StockAnalysisRow, "sl" | "itemCode" | "itemName" | "uom" | "rate">;

export interface CategoryRow {
  kg: number;
  pcs: number;
  amount: number;
}

export interface StockAnalysisReport {
  fromDate: string;
  toDate: string;
  branch: { name: string; address: string; vatNo: string };
  items: StockAnalysisRow[];
  totals: StockAnalysisTotals;
  summary: {
    cashSale: number;
    cardSale: number;
    creditSale: number;
    totalSale: number;
    ncSale: number;
    discount: number;
    grandTotal: number;
  };
  categories: {
    regular: CategoryRow;
    assorted: CategoryRow;
    issue: CategoryRow;
    credit: CategoryRow;
  };
}

// Date range [fromDate, toDate] (inclusive). Pass an empty/undefined branchId to
// aggregate ALL branches.
export const fetchStockAnalysis = (fromDate: string, toDate: string, branchId?: string) =>
  api
    .get<StockAnalysisReport>(
      `/reports/stock-analysis?fromDate=${fromDate}&toDate=${toDate}${branchId ? `&branchId=${branchId}` : ""}`,
    )
    .then((r) => r.data);
