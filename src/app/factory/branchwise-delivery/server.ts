import api from "@/lib/api";

/** One item's delivery row: a qty per day of the range, plus the totals. */
export interface BranchwiseDeliveryRow {
  sl: number;
  itemCode: string;
  itemName: string;
  uom: string;
  /** Effective unit price INCLUSIVE of VAT — Amount ÷ TotalQty, so it stays
   *  consistent with the money even when lines went out at different prices
   *  during the range. (Item_Issue.unitPrice is ex-VAT; the server grosses it
   *  up by the VAT percent on the price row in force that day.) */
  rate: number;
  /** Qty keyed by `YYYY-MM-DD`; days with no delivery are absent, not zero. */
  qtyByDate: Record<string, number>;
  totalQty: number;
  amount: number;
}

export interface BranchwiseDeliveryReport {
  fromDate: string;
  toDate: string;
  /** Every day of the range as `YYYY-MM-DD`, in order — one table column each. */
  days: string[];
  company: { name: string; address: string };
  /** Where the goods went out FROM — printed as the letterhead branch. */
  issueBranch: { id: string; name: string; address: string; vatNo: string };
  /** Where they were delivered TO; `All Branches` when no receiver was picked. */
  receiveBranch: { id: string; name: string };
  items: BranchwiseDeliveryRow[];
  totals: { qtyByDate: Record<string, number>; totalQty: number; amount: number };
}

/** Factory-only — the backend 403s unless the session branch is the factory.
 *  `issueBranchId` omitted falls back to the session branch; `receiveBranchId`
 *  omitted means every receiving branch. */
export const fetchBranchwiseDelivery = (
  fromDate: string,
  toDate: string,
  issueBranchId?: string,
  receiveBranchId?: string,
) =>
  api
    .get<BranchwiseDeliveryReport>(
      `/reports/branchwise-delivery?fromDate=${fromDate}&toDate=${toDate}` +
        `${issueBranchId ? `&issueBranchId=${issueBranchId}` : ""}` +
        `${receiveBranchId ? `&receiveBranchId=${receiveBranchId}` : ""}`,
    )
    .then((r) => r.data);
