import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface Assortment {
  id: string;
  code?: string;
  date?: string;
  type?: string;
  netAmt?: number;
}


export const fetchAssortments = () =>
  api.get<{ data: Assortment[] } | Assortment[]>("/assortment").then(unwrapList<Assortment>);
