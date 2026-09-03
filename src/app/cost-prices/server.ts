import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface CostPrice {
  id: string;
  /** Item_Information.ID (uuid) — not the item code. */
  priceItemOId?: string;
  priceFromDate?: string;
  priceToDate?: string;
  priceListPrice?: number;
  item?: { itmCode?: string; itmName?: string };
}

export interface CostPricePayload {
  /** Item_Information.ID (uuid). */
  priceItemOId: string;
  priceFromDate: string;
  priceToDate: string;
  priceListPrice: number;
}

export interface AvailableItem {
  /** Item_Information.ID — what t_CostPr keys on; the code is display only. */
  id: string;
  itmCode: string;
  itmName?: string;
}

export const fetchCostPrices = ({ page = 1, limit = 10 } = {}): Promise<Paginated<CostPrice>> =>
  api.get(`/pricing/cost-prices?page=${page}&limit=${limit}`).then(unwrapPaginated<CostPrice>);

export const createCostPrice = (data: CostPricePayload) =>
  api.post<CostPrice>("/pricing/cost-prices", data).then((r) => r.data);

export const updateCostPrice = (id: string, data: Partial<CostPricePayload>) =>
  api.patch<CostPrice>(`/pricing/cost-prices/${id}`, data).then((r) => r.data);

export const fetchItems = (): Promise<AvailableItem[]> =>
  api.get("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);
