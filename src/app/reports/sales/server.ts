import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface SalesReportRow {
  id: number;
  invNo?: string;
  date?: string;
  customerName?: string;
  totalAmount?: number;
  discount?: number;
  netAmount?: number;
  saleType?: string;
}


export const fetchSalesReport = (from: string, to: string) =>
  api.get<{ data: SalesReportRow[] } | SalesReportRow[]>(`/reports/sales?from=${from}&to=${to}`).then(unwrapList<SalesReportRow>);
