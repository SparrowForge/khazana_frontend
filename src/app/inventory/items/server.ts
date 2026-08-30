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
  /** Whether a document discount may be taken off this item. False bills it in
   *  full AND removes its value from the base the discount is charged on. */
  isDiscountApplicable?: boolean;
  /** Current active selling price and its VAT rate, flattened onto the row by
   *  the list endpoint (0 when the item has never been priced). */
  price?: number;
  vatPercentage?: number;
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
  isDiscountApplicable?: boolean;
}

export const fetchItems = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Item>> =>
  api.get(`/inventory/items?page=${page}&limit=${limit}`).then(unwrapPaginated<Item>);

export const fetchAllItems = (limit = 100): Promise<Item[]> =>
  api.get(`/inventory/items?limit=${limit}`).then(unwrapList<Item>);

/** Suggests the next Item Code for a category: its first letter plus a
 *  4-digit running count, e.g. "Sweets" -> S0001. */
export const fetchNextItemCode = (category: string): Promise<string> =>
  api.get(`/inventory/items/next-code?category=${encodeURIComponent(category)}`).then((r) => r.data.itmCode);

export const createItem = (data: ItemPayload) =>
  api.post<Item>("/inventory/items", data).then((r) => r.data);

export const updateItem = (id: string, data: Partial<ItemPayload>) =>
  api.patch<Item>(`/inventory/items/${id}`, data).then((r) => r.data);

export const deleteItem = (id: string) =>
  api.delete(`/inventory/items/${id}`).then((r) => r.data);
