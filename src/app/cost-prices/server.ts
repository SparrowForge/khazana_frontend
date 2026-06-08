import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchCostPrices = () =>
  api.get<{ data: CostPrice[] } | CostPrice[]>("/cost-prices").then(unwrap<CostPrice[]>);

export const createCostPrice = (data: CostPricePayload) =>
  api.post<CostPrice>("/cost-prices", data).then((r) => r.data);

export const updateCostPrice = (id: string, data: Partial<CostPricePayload>) =>
  api.patch<CostPrice>(`/cost-prices/${id}`, data).then((r) => r.data);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/items?limit=500").then(unwrap<AvailableItem[]>);
