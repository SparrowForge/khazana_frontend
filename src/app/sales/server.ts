import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

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

export const fetchSales = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Sale>> =>
  api.get(`/sales?page=${page}&limit=${limit}`).then(unwrapPaginated<Sale>);
