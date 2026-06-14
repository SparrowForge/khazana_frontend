import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface MoneyReceive {
  id: number;
  receiptNo: string;
  receiptDate: string;
  customerCode: string;
  amount: number;
  paymentMethod?: string;
  description?: string;
}

export interface MoneyReceivePayload {
  receiptNo?: string;
  receiptDate: string;
  customerCode: string;
  amount: number;
  paymentMethod?: string;
  description?: string;
}

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
  listMoneyReceive: () =>
    api.get<{ data: MoneyReceive[] } | MoneyReceive[]>("/finance/money-receive").then(unwrapList<MoneyReceive>),

  createMoneyReceive: (data: MoneyReceivePayload) =>
    api.post<MoneyReceive>("/finance/money-receive", data).then((r) => r.data),

  listCashPurchase: () =>
    api.get<{ data: CashPurchase[] } | CashPurchase[]>("/finance/cash-purchase").then(unwrapList<CashPurchase>),

  createCashPurchase: (data: CashPurchasePayload) =>
    api.post<CashPurchase>("/finance/cash-purchase", data).then((r) => r.data),
};
