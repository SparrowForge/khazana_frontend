import api from "@/lib/api";

export interface DiscountSummaryRow {
  date: string;
  invoiceNo: string;
  /** VAT-inclusive invoice value BEFORE the discount — the base the rate was charged on. */
  amount: number;
  /** The discount as a rate. Stored on credit invoices, derived from the money elsewhere. */
  discountPercent: number;
  discount: number;
  /** Who the discount was given to: the name typed at the till for a walk-in,
   *  the customer the sale was billed to, or — on a sale discounted before
   *  either existed — the typed authoriser. */
  customerName: string;
  /** Their contact no, resolved in the same order. */
  contactNo: string;
  /** A note written about the discount. Credit invoices only; a counter sale
   *  has no field for one, so it is blank there. */
  remarks: string;
  outlet: string;
}

export interface DiscountSummary {
  fromDate: string;
  toDate: string;
  branch: { id: string; name: string; address: string };
  items: DiscountSummaryRow[];
  totals: { amount: number; discount: number };
}

// Date range [fromDate, toDate] (inclusive). `branchId` omitted aggregates every branch.
export const fetchDiscountSummary = (fromDate: string, toDate: string, branchId?: string) =>
  api
    .get<DiscountSummary>(
      `/reports/discount-summary?fromDate=${fromDate}&toDate=${toDate}${branchId ? `&branchId=${branchId}` : ""}`,
    )
    .then((r) => r.data);
