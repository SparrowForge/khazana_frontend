import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=500").then(unwrap<AvailableItem[]>);

export const adjustStock = (data: AdjustmentPayload) =>
  api.post("/inventory/adjust", data).then((r) => r.data);
