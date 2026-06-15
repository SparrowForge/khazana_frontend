import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface CashPurchase {
  id: number;
  voucherNo: string;
  voucherDate: string;
  supplier?: string;
  amount: number;
  description?: string;
}

export interface CashPurchasePayload {
  voucherNo?: string;
  voucherDate?: string;
  supplier?: string;
  amount: number;
  description?: string;
}

export const fetchCashPurchases = ({ page = 1, limit = 10 } = {}): Promise<Paginated<CashPurchase>> =>
  api.get(`/finance/cash-purchase?page=${page}&limit=${limit}`).then(unwrapPaginated<CashPurchase>);

export const createCashPurchase = (data: CashPurchasePayload) =>
  api.post<CashPurchase>("/finance/cash-purchase", data).then((r) => r.data);
