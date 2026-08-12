import api from "@/lib/api";

export interface ItemRejectRow {
  sl: number;
  itemCode: string;
  itemName: string;
  uom: string;
  /** Current active price, VAT-inclusive. */
  price: number;
  /** Reject qty, keyed by ISO date (e.g. "2026-07-01"), one key per `dates` entry. */
  qtyByDate: Record<string, number>;
  totalQty: number;
  amount: number;
}

export interface ItemRejectReport {
  fromDate: string;
  toDate: string;
  branch: { id: string; name: string };
  /** Ordered ISO dates — one per column. */
  dates: string[];
  items: ItemRejectRow[];
  totals: { byDate: Record<string, number>; totalQty: number; amount: number };
}

// Date range [fromDate, toDate] (inclusive). `branchId` omitted aggregates every branch.
export const fetchItemRejectReport = (fromDate: string, toDate: string, branchId?: string) =>
  api
    .get<ItemRejectReport>(
      `/reports/item-reject?fromDate=${fromDate}&toDate=${toDate}${branchId ? `&branchId=${branchId}` : ""}`,
    )
    .then((r) => r.data);
