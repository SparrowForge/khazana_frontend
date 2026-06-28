import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface Payment {
  id: bigint | number | string;
  customerId?: string;
  customer?: { code?: string; name?: string };
  receiveDate?: string;
  receiveAmount?: number;
  tType?: string;
  moneyReceptNo?: string;
  bankName?: string;
}

export interface PaymentPayload {
  customerId: string;
  receiveDate: string;
  receiveAmount: number;
  tType?: string;
  moneyReceptNo?: string;
  bankName?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
}


export const fetchPayments = () =>
  api.get<{ data: Payment[] } | Payment[]>("/customers/payments").then(unwrapList<Payment>);

export const createPayment = (data: PaymentPayload) =>
  api.post<Payment>("/customers/payments", data).then((r) => r.data);

export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers?limit=100").then(unwrapList<Customer>);
