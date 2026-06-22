import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";
export type { MediaFile } from "@/lib/upload";
export { uploadFile } from "@/lib/upload";

export interface Item {
  id: string;
  itmCode: string;
  itmName?: string;
  itmCategory?: string;
  itmType?: string;
  itmUOM?: string;
  itmRemarks?: string;
  imageId?: string | null;
  image?: import("@/lib/upload").MediaFile | null;
  isActive?: string;
}

export interface ItemPayload {
  itmCode: string;
  itmName?: string;
  itmCategory?: string;
  itmType?: string;
  itmUOM?: string;
  itmRemarks?: string;
  imageId?: string;
  isActive?: string;
}

export const fetchItems = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Item>> =>
  api.get(`/inventory/items?page=${page}&limit=${limit}`).then(unwrapPaginated<Item>);

export const fetchAllItems = (limit = 100): Promise<Item[]> =>
  api.get(`/inventory/items?limit=${limit}`).then(unwrapList<Item>);

export const createItem = (data: ItemPayload) =>
  api.post<Item>("/inventory/items", data).then((r) => r.data);

export const updateItem = (id: string, data: Partial<ItemPayload>) =>
  api.patch<Item>(`/inventory/items/${id}`, data).then((r) => r.data);

export const deleteItem = (id: string) =>
  api.delete(`/inventory/items/${id}`).then((r) => r.data);
