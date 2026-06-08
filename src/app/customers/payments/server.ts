import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchPayments = () =>
  api.get<{ data: Payment[] } | Payment[]>("/customers/payments").then(unwrap<Payment[]>);

export const createPayment = (data: PaymentPayload) =>
  api.post<Payment>("/customers/payments", data).then((r) => r.data);

export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers?limit=500").then(unwrap<Customer[]>);
