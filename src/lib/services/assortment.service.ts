import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface Assortment {
  id: number;
  code?: string;
  date?: string;
  type?: string;
  netAmt?: number;
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


export const assortmentService = {
  list: () =>
    api.get<{ data: Assortment[] } | Assortment[]>("/assortment").then(unwrapList<Assortment>),

  create: (data: AssortmentPayload) =>
    api.post("/assortment", data).then((r) => r.data),
};
