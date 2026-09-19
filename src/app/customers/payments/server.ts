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
  /** Contact no — searchable in the picker, and shown on the row there. */
  mobile?: string;
  address?: string;
}


export const fetchPayments = () =>
  api.get<{ data: Payment[] } | Payment[]>("/customers/payments").then(unwrapList<Payment>);

export const createPayment = (data: PaymentPayload) =>
  api.post<Payment>("/customers/payments", data).then((r) => r.data);

/** Customers for the picker: /customers/options is flat and un-capped, unlike
 *  the paginated /customers, which stops at 100 rows — a customer past the
 *  hundredth by name could not be billed at all. Carries the contact no, which
 *  the picker searches alongside the code and the name. */
export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers/options").then(unwrapList<Customer>);
