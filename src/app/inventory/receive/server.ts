import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
}

export interface ReceivePayload {
  voucherNo?: string;
  purDate: string;
  items: { itemCode: string; qty: number }[];
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const receiveStock = (data: ReceivePayload) =>
  api.post("/inventory/receive", data).then((r) => r.data);
