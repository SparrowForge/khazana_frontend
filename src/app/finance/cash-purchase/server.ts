import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchCashPurchases = () =>
  api.get<{ data: CashPurchase[] } | CashPurchase[]>("/finance/cash-purchase").then(unwrap<CashPurchase[]>);

export const createCashPurchase = (data: CashPurchasePayload) =>
  api.post<CashPurchase>("/finance/cash-purchase", data).then((r) => r.data);
