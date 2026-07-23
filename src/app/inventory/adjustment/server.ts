import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
}

export interface AdjustmentPayload {
  invNo?: string;
  date: string;
  items: { itmOId: string; reject: number; excess: number; short: number; assort: number }[];
}

/** One row in the Stock Adjustment list — one per reference number, each
 *  figure is the sum across every item line sharing that reference. */
export interface AdjustmentRecord {
  id?: string;
  invNo: string;
  reject?: number;
  excess?: number;
  short?: number;
  assort?: number;
  date?: string;
  branchId?: string;
}

/** Full adjustment document for a reference number, with all its item lines. */
export interface AdjustmentGroup {
  invNo: string;
  date?: string;
  branchId?: string;
  items: { itmOId: string; itemName?: string; reject: number; excess: number; short: number; assort: number }[];
}

export interface UpdateAdjustmentPayload {
  date?: string;
  items: { itmOId: string; reject: number; excess: number; short: number; assort: number }[];
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const adjustStock = (data: AdjustmentPayload) =>
  api.post("/inventory/adjust", data).then((r) => r.data);

export const fetchAdjustments = ({ page = 1, limit = 10, fromDate, toDate }: { page?: number; limit?: number; fromDate?: string; toDate?: string } = {}): Promise<Paginated<AdjustmentRecord>> => {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("limit", String(limit));
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  return api.get(`/inventory/adjust/history?${params.toString()}`).then(unwrapPaginated<AdjustmentRecord>);
};

export const fetchAdjustment = (invNo: string): Promise<AdjustmentGroup> =>
  api.get(`/inventory/adjust/${encodeURIComponent(invNo)}`).then((r) => r.data);

export const updateAdjustment = (invNo: string, data: UpdateAdjustmentPayload) =>
  api.patch(`/inventory/adjust/${encodeURIComponent(invNo)}`, data).then((r) => r.data);

export const deleteAdjustment = (invNo: string) =>
  api.delete(`/inventory/adjust/${encodeURIComponent(invNo)}`).then((r) => r.data);
