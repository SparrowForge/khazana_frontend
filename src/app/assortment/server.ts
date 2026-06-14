import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface AssortmentPayload {
  code?: string;
  date: string;
  type: string;
  items: SaleItem[];
  totalAmt: number;
  discAmt: number;
  netAmt: number;
  customerpay: number;
  change: number;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items").then(unwrapList<AvailableItem>);

export const createAssortment = (data: AssortmentPayload) =>
  api.post("/assortment", data).then((r) => r.data);
