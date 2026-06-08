import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchMoneyReceive = () =>
  api.get<{ data: MoneyReceive[] } | MoneyReceive[]>("/finance/money-receive").then(unwrap<MoneyReceive[]>);

export const createMoneyReceive = (data: MoneyReceivePayload) =>
  api.post<MoneyReceive>("/finance/money-receive", data).then((r) => r.data);

export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers?limit=500").then(unwrap<Customer[]>);
