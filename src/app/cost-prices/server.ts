import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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


export const fetchCostPrices = () =>
  api.get<{ data: CostPrice[] } | CostPrice[]>("/pricing/cost-prices").then(unwrapList<CostPrice>);

export const createCostPrice = (data: CostPricePayload) =>
  api.post<CostPrice>("/pricing/cost-prices", data).then((r) => r.data);

export const updateCostPrice = (id: string, data: Partial<CostPricePayload>) =>
  api.patch<CostPrice>(`/pricing/cost-prices/${id}`, data).then((r) => r.data);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=500").then(unwrapList<AvailableItem>);
