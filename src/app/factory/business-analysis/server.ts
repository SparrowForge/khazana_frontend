import api from "@/lib/api";

/** One printed line of the statement: a quantity per unit of measure, and one
 *  money figure. Quantities are keyed by UOM and never added across units. */
export interface BusinessAnalysisRow {
  label: string;
  /** Qty keyed by unit of measure; units with nothing on this row are absent. */
  qty: Record<string, number>;
  amount: number;
}

export interface BusinessAnalysisReport {
  fromDate: string;
  toDate: string;
  company: { name: string; address: string };
  branch: { id: string; name: string; address: string; vatNo: string };
  /** Quantity columns, in print order — one per unit of measure in play. */
  uoms: string[];
  /** The legacy pad's raw-materials block. Nothing in this system records raw
   *  purchases, indents or a raw store, so `available` is false and every figure
   *  is zero — which is exactly how the legacy sheet prints it too. */
  mainStore: {
    available: boolean;
    columns: string[];
    rows: BusinessAnalysisRow[];
  };
  /** The stock statement proper. `inflowTotal` and `outflowTotal` are equal in
   *  every quantity column and in money — that is the point of the sheet.
   *
   *  Every row is valued on the same basis as the Production & Delivery report
   *  (VAT-inclusive list rate, except sales at actual money and production at
   *  its recorded rate), so the two cross-check line for line. The outflow block
   *  carries a `Discount & Rate Variance` row that absorbs the difference the
   *  two valuation bases create, rather than letting it inflate Closing
   *  Balance. `Over` sits in the outflow block as a negative — it is stock found,
   *  so it reduces what must have gone out — which is what makes `inflowTotal`
   *  equal that report's "Total Stock". */
  finishGoods: {
    inflow: BusinessAnalysisRow[];
    inflowTotal: BusinessAnalysisRow;
    outflow: BusinessAnalysisRow[];
    outflowTotal: BusinessAnalysisRow;
  };
  /** The pad's "Comments: (Factory)" box — a restatement of the Short and Over
   *  rows already counted in the blocks above. */
  comments: { short: BusinessAnalysisRow; over: BusinessAnalysisRow };
}

/** Factory-only — the backend 403s unless the session branch is the factory.
 *  There is no all-branches option: a stock roll-forward is per branch. */
export const fetchBusinessAnalysis = (fromDate: string, toDate: string, branchId?: string) =>
  api
    .get<BusinessAnalysisReport>(
      `/reports/business-analysis?fromDate=${fromDate}&toDate=${toDate}` +
        `${branchId ? `&branchId=${branchId}` : ""}`,
    )
    .then((r) => r.data);
