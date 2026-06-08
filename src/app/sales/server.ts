import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchSales = () =>
  api.get<{ data: Sale[] } | Sale[]>("/sales").then(unwrap<Sale[]>);
