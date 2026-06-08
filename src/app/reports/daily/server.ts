import api from "@/lib/api";

export interface DailySummary {
  cashSales?: number;
  creditSales?: number;
  vatCashSales?: number;
  vatCreditSales?: number;
  totalSales?: number;
  totalRevenue?: number;
}

export interface SaleRow {
  id: number;
  invNo?: string;
  type?: string;
  netAmount?: number;
}

export const fetchDailySummary = (date: string) =>
  api.get<{ summary?: DailySummary; details?: SaleRow[]; data?: SaleRow[] }>(`/reports/daily?date=${date}`)
    .then((r) => ({ summary: r.data.summary ?? null, details: r.data.details ?? r.data.data ?? [] }));
