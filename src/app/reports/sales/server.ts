import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchSalesReport = (from: string, to: string) =>
  api.get<{ data: SalesReportRow[] } | SalesReportRow[]>(`/reports/sales?from=${from}&to=${to}`).then(unwrap<SalesReportRow[]>);
