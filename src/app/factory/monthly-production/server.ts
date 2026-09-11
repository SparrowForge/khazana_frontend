import api from "@/lib/api";

/** One item's production row: a qty per day of the range, plus the totals. */
export interface MonthlyProductionRow {
  sl: number;
  itemCode: string;
  itemName: string;
  /** Unit of measure — also what the row's block is grouped by. */
  uom: string;
  /** Effective unit price INCLUSIVE of VAT — Amount ÷ TotalQty. Exact (and so
   *  Rate × TotalQty ties back to Amount) whenever the item was produced at a
   *  single rate; see `rateIsAverage` for when it isn't. `Production.rate` is
   *  already VAT-inclusive, so nothing is grossed up on the way out. */
  rate: number;
  /** True when the item was produced at more than one rate in the range, making
   *  `rate` a weighted average that need not multiply out to `amount` exactly.
   *  The sheet marks these rows with a "~" so they don't read as bad arithmetic. */
  rateIsAverage: boolean;
  /** Qty keyed by `YYYY-MM-DD`; days with no production are absent, not zero. */
  qtyByDate: Record<string, number>;
  totalQty: number;
  amount: number;
}

export interface MonthlyProductionTotals {
  qtyByDate: Record<string, number>;
  totalQty: number;
  amount: number;
}

/** One block of the sheet: every item sharing a unit of measure, with its own
 *  subtotal. Quantities are only ever added up WITHIN a block — a KG total and
 *  a Pcs total are different things and must not be merged. */
export interface MonthlyProductionGroup {
  uom: string;
  items: MonthlyProductionRow[];
  totals: MonthlyProductionTotals;
}

export interface MonthlyProductionReport {
  fromDate: string;
  toDate: string;
  /** Every day of the range as `YYYY-MM-DD`, in order — one table column each. */
  days: string[];
  company: { name: string; address: string };
  /** The producing branch; `All Branches` when none was picked. */
  branch: { id: string; name: string; address: string; vatNo: string };
  /** One per unit of measure, in the order they print. */
  groups: MonthlyProductionGroup[];
  /** Across every block. `amount` is the meaningful figure; `totalQty` adds
   *  quantities in different units and is carried only because the legacy sheet
   *  prints it. */
  totals: MonthlyProductionTotals;
}

/** Factory-only — the backend 403s unless the session branch is the factory.
 *  `branchId` omitted means every branch ("All Branch"). */
export const fetchMonthlyProduction = (fromDate: string, toDate: string, branchId?: string) =>
  api
    .get<MonthlyProductionReport>(
      `/reports/monthly-production?fromDate=${fromDate}&toDate=${toDate}` +
        `${branchId ? `&branchId=${branchId}` : ""}`,
    )
    .then((r) => r.data);
