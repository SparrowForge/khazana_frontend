import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface MoneyReceive {
  id: number;
  receiptNo: string;
  receiptDate: string;
  customerCode: string;
  amount: number;
  paymentMethod?: string;
}

export interface MoneyReceivePayload {
  receiptNo?: string;
  receiptDate: string;
  customerCode: string;
  amount: number;
  paymentMethod?: string;
  description?: string;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
}


export const fetchMoneyReceive = () =>
  api.get<{ data: MoneyReceive[] } | MoneyReceive[]>("/finance/money-receive").then(unwrapList<MoneyReceive>);

export const createMoneyReceive = (data: MoneyReceivePayload) =>
  api.post<MoneyReceive>("/finance/money-receive", data).then((r) => r.data);

export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers?limit=500").then(unwrapList<Customer>);
