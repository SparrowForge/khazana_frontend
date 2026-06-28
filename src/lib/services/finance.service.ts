import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface CashPurchase {
  id: number;
  voucherNo?: string;
  date: string;
  description?: string;
  amount: number;
  paymentMethod?: string;
}

export interface CashPurchasePayload {
  voucherNo?: string;
  date: string;
  description?: string;
  amount: number;
  paymentMethod?: string;
}


export const financeService = {
  listCashPurchase: () =>
    api.get<{ data: CashPurchase[] } | CashPurchase[]>("/finance/cash-purchase").then(unwrapList<CashPurchase>),

  createCashPurchase: (data: CashPurchasePayload) =>
    api.post<CashPurchase>("/finance/cash-purchase", data).then((r) => r.data),
};
