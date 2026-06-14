import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface Sale {
  id: string | number;
  invoiceNo?: string;
  invNo?: string;
  date?: string;
  somstrDate?: string;
  invDate?: string;
  netAmount?: number;
  somstrNetAmt?: number;
  type?: string;
}


export const fetchSales = () =>
  api.get<{ data: Sale[] } | Sale[]>("/sales").then(unwrapList<Sale>);
