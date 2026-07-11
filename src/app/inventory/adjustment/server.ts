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

export interface AdjustmentRecord {
  id: string;
  invNo?: string;
  itmOId?: string;
  reject?: number;
  excess?: number;
  short?: number;
  assort?: number;
  date?: string;
  item?: { itmCode?: string; itmName?: string };
}

export interface UpdateAdjustmentPayload {
  invNo?: string;
  date?: string;
  itmOId?: string;
  reject?: number;
  excess?: number;
  short?: number;
  assort?: number;
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const adjustStock = (data: AdjustmentPayload) =>
  api.post("/inventory/adjust", data).then((r) => r.data);

export const fetchAdjustments = ({ page = 1, limit = 10 } = {}): Promise<Paginated<AdjustmentRecord>> =>
  api.get(`/inventory/adjust/history?page=${page}&limit=${limit}`).then(unwrapPaginated<AdjustmentRecord>);

export const fetchAdjustment = (id: string): Promise<AdjustmentRecord> =>
  api.get(`/inventory/adjust/${id}`).then((r) => r.data);

export const updateAdjustment = (id: string, data: UpdateAdjustmentPayload) =>
  api.patch(`/inventory/adjust/${id}`, data).then((r) => r.data);

export const deleteAdjustment = (id: string) =>
  api.delete(`/inventory/adjust/${id}`).then((r) => r.data);
