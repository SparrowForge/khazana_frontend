import api from "@/lib/api";

/** One item's movement at the selected branch. `Opening + In − Out = Closing`
 *  holds exactly on every row — In and Out carry every ledger that moves stock
 *  (production, receive, issue, all four sale ledgers, NC, assortment and the
 *  reject columns), not just receives and issues. */
export interface StockRow {
  id: string;
  itemCode?: string;
  itemName?: string;
  uom?: string;
  /** Roll-forward of everything dated before the range. Can be negative — a
   *  branch that issued more than it held really is short, and clamping that to
   *  zero is what used to hide an over-issue. */
  openingQty?: number;
  inwardQty?: number;
  outwardQty?: number;
  closingQty?: number;
}

export interface StockReport {
  /** Null when the report was run without a start date ("since the beginning"). */
  fromDate: string | null;
  /** Null when run without an end date ("up to now"). */
  toDate: string | null;
  branch: { id: string; name: string };
  items: StockRow[];
}

/** `branchId` omitted combines every branch — the company-wide position, which
 *  is what the old report always showed. Dates are optional. */
export const fetchStockReport = (fromDate?: string, toDate?: string, branchId?: string) =>
  api
    .get<StockReport>(
      `/reports/stock?${[
        fromDate ? `fromDate=${fromDate}` : "",
        toDate ? `toDate=${toDate}` : "",
        branchId ? `branchId=${branchId}` : "",
      ]
        .filter(Boolean)
        .join("&")}`,
    )
    .then((r) => r.data);
