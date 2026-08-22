import api from "@/lib/api";

export interface DiscountSummaryRow {
  date: string;
  invoiceNo: string;
  /** VAT-inclusive invoice value BEFORE the discount — the base the rate was charged on. */
  amount: number;
  /** The discount as a rate. Stored on credit invoices, derived from the money elsewhere. */
  discountPercent: number;
  discount: number;
  /** Discount authoriser's phone (counter sales) or the customer's mobile (credit). */
  contactNo: string;
  /** Discount authoriser (counter sales) or the customer/remark (credit). */
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
