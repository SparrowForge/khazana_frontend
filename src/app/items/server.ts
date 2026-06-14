import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface Item {
  id: number;
  itmCode: string;
  itmName?: string;
  itmCategory?: string;
  itmType?: string;
  itmUOM?: string;
  isActive?: string;
}

export interface ItemPayload {
  itmCode: string;
  itmName?: string;
  itmCategory?: string;
  itmType?: string;
  itmUOM?: string;
  isActive?: string;
}


export const fetchItems = (limit = 500) =>
  api.get<{ data: Item[] } | Item[]>(`/inventory/items?limit=${limit}`).then(unwrapList<Item>);

export const createItem = (data: ItemPayload) =>
  api.post<Item>("/inventory/items", data).then((r) => r.data);

export const updateItem = (id: number, data: Partial<ItemPayload>) =>
  api.patch<Item>(`/inventory/items/${id}`, data).then((r) => r.data);

export const deleteItem = (id: number) =>
  api.delete(`/inventory/items/${id}`).then((r) => r.data);
