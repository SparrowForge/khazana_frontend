import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Price {
  id: string;
  /** Item_Information.ID (uuid) — not the item code. */
  priceItemOId?: string;
  priceFromDate?: string;
  priceToDate?: string;
  priceListPrice?: number;
  priceVatPercent?: number;
  priceIsActive?: number;
  item?: { itmCode?: string; itmName?: string };
}

export interface PricePayload {
  /** Item_Information.ID (uuid). */
  priceItemOId: string;
  priceFromDate: string;
  priceToDate: string;
  priceListPrice: number;
  priceVatPercent: number;
  priceIsActive: number;
}

export interface AvailableItem {
  /** Item_Information.ID — what t_Price keys on; the code is display only. */
  id: string;
  itmCode: string;
  itmName?: string;
}

export const fetchPrices = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Price>> =>
  api.get(`/pricing/prices?page=${page}&limit=${limit}`).then(unwrapPaginated<Price>);

export const createPrice = (data: PricePayload) =>
  api.post<Price>("/pricing/prices", data).then((r) => r.data);

export const updatePrice = (id: string, data: Partial<PricePayload>) =>
  api.patch<Price>(`/pricing/prices/${id}`, data).then((r) => r.data);

export const fetchItems = (): Promise<AvailableItem[]> =>
  api.get("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

/** The item's currently active price, or null if it has never been priced.
 *  Backs the Price Setup dialog opened from the Items page, which prefills
 *  with whatever the item is selling for today. Responds with the raw t_Price
 *  row (no envelope) — an unpriced item comes back empty. */
export const fetchCurrentPrice = (itemId: string): Promise<Price | null> =>
  api
    .get<Price | null | "">(`/pricing/prices/current?itemId=${encodeURIComponent(itemId)}`)
    .then((r) => (r.data && typeof r.data === "object" ? r.data : null))
    .catch(() => null);
