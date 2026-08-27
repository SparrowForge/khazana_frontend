import api from "@/lib/api";

/**
 * One packet's line on the stock register.
 *
 * `opening` is the balance carried in from before `fromDate`; `received` and
 * `issued` are movement inside the window; `balance` is
 * `opening + received - issued`, i.e. the closing balance as at `toDate` — not
 * an all-time total. Movement after `toDate` is excluded from all four.
 */
export interface PacketStockRow {
  code: string;
  name?: string;
  uom?: string;
  rate?: number;
  opening: number;
  received: number;
  issued: number;
  balance: number;
}

export interface PacketStockTotals {
  opening: number;
  received: number;
  issued: number;
  balance: number;
}

export interface PacketStockReport {
  fromDate?: string;
  toDate?: string;
  branchId?: string;
  items: PacketStockRow[];
  totals: PacketStockTotals;
}

export const fetchPacketStock = ({
  fromDate,
  toDate,
  branchId,
  code,
  includeEmpty,
}: {
  fromDate?: string;
  toDate?: string;
  branchId?: string;
  code?: string;
  /** Show every active packet, including those with no balance and no movement. */
  includeEmpty?: boolean;
} = {}): Promise<PacketStockReport> => {
  const params = new URLSearchParams();
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  if (branchId) params.append("branchId", branchId);
  if (code) params.append("code", code);
  if (includeEmpty) params.append("includeEmpty", "1");
  const qs = params.toString();
  return api.get(`/packets/stock${qs ? `?${qs}` : ""}`).then((r) => r.data);
};
