import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Price {
  id: string;
  priceItemOId?: string;
  priceFromDate?: string;
  priceToDate?: string;
  priceListPrice?: number;
  priceVatPercent?: number;
  priceIsActive?: number;
  item?: { itmCode?: string; itmName?: string };
}

export interface PricePayload {
  priceItemOId: string;
  priceFromDate: string;
  priceToDate: string;
  priceListPrice: number;
  priceVatPercent: number;
  priceIsActive: number;
}

export interface AvailableItem {
  id: number;
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
