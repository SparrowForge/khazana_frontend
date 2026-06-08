import api from "@/lib/api";
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

const unwrap = <T>(res: { data: { data?: T } | T }): T =>
  (res.data as { data?: T }).data ?? (res.data as T);

export const assortmentService = {
  list: () =>
    api.get<{ data: Assortment[] } | Assortment[]>("/assortment").then(unwrap<Assortment[]>),

  create: (data: AssortmentPayload) =>
    api.post("/assortment", data).then((r) => r.data),
};
