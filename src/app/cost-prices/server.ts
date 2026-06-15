import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface CostPrice {
  priceOId: string;
  priceItemOId?: string;
  priceFromDate?: string;
  priceToDate?: string;
  priceListPrice?: number;
  item?: { itmCode?: string; itmName?: string };
}

export interface CostPricePayload {
  priceItemOId: string;
  priceFromDate: string;
  priceToDate: string;
  priceListPrice: number;
}

export interface AvailableItem {
  id: number;
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
  api.get("/inventory/items?limit=100").then(unwrapList<AvailableItem>);
