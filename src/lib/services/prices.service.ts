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
  priceVatPercent?: number;
  priceIsActive?: number;
}

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


export const pricesService = {
  list: () =>
    api.get<{ data: Price[] } | Price[]>("/prices").then(unwrapList<Price>),

  create: (data: PricePayload) =>
    api.post<Price>("/prices", data).then((r) => r.data),

  update: (id: string, data: Partial<PricePayload>) =>
    api.patch<Price>(`/prices/${id}`, data).then((r) => r.data),

  listCost: () =>
    api.get<{ data: CostPrice[] } | CostPrice[]>("/cost-prices").then(unwrapList<CostPrice>),

  createCost: (data: CostPricePayload) =>
    api.post<CostPrice>("/cost-prices", data).then((r) => r.data),

  updateCost: (id: string, data: Partial<CostPricePayload>) =>
    api.patch<CostPrice>(`/cost-prices/${id}`, data).then((r) => r.data),
};
