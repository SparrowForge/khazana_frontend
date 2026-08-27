import api from "@/lib/api";

/** Which column of the ItemReject row the report prints. Reject, Excess and
 *  Short are the same document with a different source column and heading. */
export type PosAdjustmentKind = "reject" | "excess" | "short";

/** One printed line: an item's total for a single day. */
export interface PosAdjustmentLine {
  itemCode: string;
  itemName: string;
  uom: string;
  qty: number;
  /** Current active price, VAT-inclusive — the same basis the A4 Item Reject
   *  Report prices its Amount column on. */
  rate: number;
  amount: number;
}

/** A day that actually had movement. Days with none are absent, not blank. */
export interface PosAdjustmentDay {
  /** ISO date, e.g. "2020-12-23". */
  date: string;
  items: PosAdjustmentLine[];
  subTotalQty: number;
  subTotalAmount: number;
}

export interface PosAdjustmentReport {
  kind: PosAdjustmentKind;
  fromDate: string;
  toDate: string;
  /** Header block for the receipt. Address/VAT/cell are blank for All Branches. */
  branch: { id: string; name: string; address: string; vatNo: string; mobileNo: string };
  days: PosAdjustmentDay[];
  grandTotal: { qty: number; amount: number };
}

/** Wording that differs between the two reports. Everything else — filters,
 *  layout, totals — is identical, which is why they share a component. */
export const POS_ADJUSTMENT_LABELS: Record<
  PosAdjustmentKind,
  { pageTitle: string; docTitle: string; qtyHeader: string; emptyText: string }
> = {
  reject: {
    pageTitle: "Reject Report(POS)",
    docTitle: "History Reject Report",
    qtyHeader: "Reject Qty",
    emptyText: "No rejects found for the selected filters.",
  },
  excess: {
    pageTitle: "Excess Report(POS)",
    docTitle: "History Excess Report",
    qtyHeader: "Excess Qty",
    emptyText: "No excess found for the selected filters.",
  },
  short: {
    pageTitle: "Short Report(POS)",
    docTitle: "History Short Report",
    qtyHeader: "Short Qty",
    emptyText: "No shortages found for the selected filters.",
  },
};

// Date range [fromDate, toDate] (inclusive). `branchId` omitted aggregates every branch.
export const fetchPosAdjustmentReport = (
  kind: PosAdjustmentKind,
  fromDate: string,
  toDate: string,
  branchId?: string,
) =>
  api
    .get<PosAdjustmentReport>(
      `/reports/${kind}-pos?fromDate=${fromDate}&toDate=${toDate}${branchId ? `&branchId=${branchId}` : ""}`,
    )
    .then((r) => r.data);
