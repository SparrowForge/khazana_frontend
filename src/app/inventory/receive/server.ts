import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=500").then(unwrap<AvailableItem[]>);

export const receiveStock = (data: ReceivePayload) =>
  api.post("/inventory/receive", data).then((r) => r.data);
