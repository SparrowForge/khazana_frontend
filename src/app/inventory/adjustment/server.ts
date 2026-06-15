import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100").then(unwrapList<AvailableItem>);

export const adjustStock = (data: AdjustmentPayload) =>
  api.post("/inventory/adjust", data).then((r) => r.data);
