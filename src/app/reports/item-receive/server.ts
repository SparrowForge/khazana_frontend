import api from "@/lib/api";

export interface ItemReceiveRow {
  sl: number;
  itemCode: string;
  itemName: string;
  uom: string;
  /** Current active price, VAT-inclusive. */
  price: number;
  /** Qty received, keyed by ISO date (e.g. "2026-07-01"), one key per `dates` entry. */
  qtyByDate: Record<string, number>;
  totalQty: number;
  amount: number;
}

export interface ItemReceiveReport {
  fromDate: string;
  toDate: string;
  receiveBranch: { id: string; name: string };
  fromBranch: { id: string; name: string };
  /** Ordered ISO dates — one per column. */
  dates: string[];
  items: ItemReceiveRow[];
  totals: { byDate: Record<string, number>; totalQty: number; amount: number };
}

// Date range [fromDate, toDate] (inclusive). `receiveBranchId` omitted aggregates
// every branch; `fromBranchId` omitted includes receipts from every source.
export const fetchItemReceiveReport = (
  fromDate: string,
  toDate: string,
  receiveBranchId?: string,
  fromBranchId?: string,
) =>
  api
    .get<ItemReceiveReport>(
      `/reports/item-receive?fromDate=${fromDate}&toDate=${toDate}` +
        (receiveBranchId ? `&receiveBranchId=${receiveBranchId}` : "") +
        (fromBranchId ? `&fromBranchId=${fromBranchId}` : ""),
    )
    .then((r) => r.data);
