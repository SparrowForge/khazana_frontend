import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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


export const fetchPrices = () =>
  api.get<{ data: Price[] } | Price[]>("/pricing/prices").then(unwrapList<Price>);

export const createPrice = (data: PricePayload) =>
  api.post<Price>("/pricing/prices", data).then((r) => r.data);

export const updatePrice = (id: string, data: Partial<PricePayload>) =>
  api.patch<Price>(`/pricing/prices/${id}`, data).then((r) => r.data);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=500").then(unwrapList<AvailableItem>);
