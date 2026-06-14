import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface Payment {
  id: bigint | number;
  clientCode?: string;
  paymentDate?: string;
  paymentAmount?: number;
  tType?: string;
  moneyReceptNo?: string;
  bankName?: string;
}

export interface PaymentPayload {
  clientCode: string;
  paymentDate: string;
  paymentAmount: number;
  tType?: string;
  moneyReceptNo?: string;
  bankName?: string;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
}


export const fetchPayments = () =>
  api.get<{ data: Payment[] } | Payment[]>("/customers/payments").then(unwrapList<Payment>);

export const createPayment = (data: PaymentPayload) =>
  api.post<Payment>("/customers/payments", data).then((r) => r.data);

export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers?limit=500").then(unwrapList<Customer>);
