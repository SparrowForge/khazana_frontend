import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

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

export const fetchMoneyReceive = ({ page = 1, limit = 10 } = {}): Promise<Paginated<MoneyReceive>> =>
  api.get(`/finance/money-receive?page=${page}&limit=${limit}`).then(unwrapPaginated<MoneyReceive>);

export const createMoneyReceive = (data: MoneyReceivePayload) =>
  api.post<MoneyReceive>("/finance/money-receive", data).then((r) => r.data);

export const fetchCustomers = (): Promise<Customer[]> =>
  api.get("/customers?limit=100").then(unwrapList<Customer>);
