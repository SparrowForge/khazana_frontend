import api from "@/lib/api";

export interface Price {
  priceOId: string;
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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchPrices = () =>
  api.get<{ data: Price[] } | Price[]>("/prices").then(unwrap<Price[]>);

export const createPrice = (data: PricePayload) =>
  api.post<Price>("/prices", data).then((r) => r.data);

export const updatePrice = (id: string, data: Partial<PricePayload>) =>
  api.patch<Price>(`/prices/${id}`, data).then((r) => r.data);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/items?limit=500").then(unwrap<AvailableItem[]>);
