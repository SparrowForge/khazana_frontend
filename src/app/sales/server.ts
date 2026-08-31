import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";
import { emitStockChanged } from "@/lib/stockEvents";

// Normalized row from the unified /sales report (all sale types in one shape).
export interface Sale {
  id: string | number;
  invoiceNo?: string;
  date?: string | null;
  type?: string;
  netAmount?: number;
  customerName?: string | null;
}

export type SalesTypeFilter = "all" | "cash" | "credit" | "vat-cash" | "vat-credit" | "nc";

export interface SalesQuery {
  page?: number;
  limit?: number;
  type?: SalesTypeFilter;
  fromDate?: string;
  toDate?: string;
}

export const fetchSales = ({ page = 1, limit = 10, type = "all" as SalesTypeFilter, fromDate, toDate }: SalesQuery = {}): Promise<Paginated<Sale>> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), type });
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  return api.get(`/sales?${params.toString()}`).then(unwrapPaginated<Sale>);
};

export const deleteCashSale = (id: string | number) => api.delete(`/sales/cash/${id}`).then((r) => { emitStockChanged("cash-sale:delete"); return r.data; });
export const deleteCreditSale = (id: string | number) => api.delete(`/sales/credit/${id}`).then((r) => { emitStockChanged("credit-sale:delete"); return r.data; });
