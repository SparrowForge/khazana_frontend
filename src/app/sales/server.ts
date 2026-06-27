import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

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

export const fetchSales = ({ page = 1, limit = 10, type = "all" as SalesTypeFilter } = {}): Promise<Paginated<Sale>> =>
  api.get(`/sales?page=${page}&limit=${limit}&type=${type}`).then(unwrapPaginated<Sale>);
