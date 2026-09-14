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
  item?: { itmCode?: string; itmName?: string; itmCategory?: string };
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
  itmCategory?: string;
}

export const fetchPrices = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Price>> =>
  api.get(`/pricing/prices?page=${page}&limit=${limit}`).then(unwrapPaginated<Price>);

/** Every active price, for Print/PDF/Excel — those export the whole price list,
 *  not the page on screen. Walked a page at a time because the list endpoint
 *  caps `limit` at 100; the rows arrive already sorted by category then item
 *  name, and paging in order preserves that. */
export const fetchAllPrices = async (): Promise<Price[]> => {
  const PAGE_SIZE = 100;
  const MAX_PAGES = 50; // 5,000 rows — a guard, not an expected ceiling
  const all: Price[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, meta } = await fetchPrices({ page, limit: PAGE_SIZE });
    all.push(...items);
    if (page >= (meta?.totalPages ?? 1) || items.length === 0) break;
  }
  return all;
};

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

/** Hard delete of a price row. History is unaffected — sale lines keep their
 *  own copy of the price charged — but the item is left unpriced until a new
 *  price is set, so the caller confirms first. */
export const deletePrice = (id: string) =>
  api.delete(`/pricing/prices/${id}`).then((r) => r.data);
