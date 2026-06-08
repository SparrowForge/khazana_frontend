import api from "@/lib/api";

export interface Customer {
  id: number;
  code: string;
  name: string;
  mobile?: string;
  address?: string;
  email?: string;
}

export interface CustomerPayload {
  code: string;
  name: string;
  mobile?: string;
  address?: string;
  email?: string;
}

export interface CustomerPayment {
  id: number;
  customerCode: string;
  customerName?: string;
  amount: number;
  date: string;
  remarks?: string;
}

export interface CustomerPaymentPayload {
  customerCode: string;
  amount: number;
  date: string;
  remarks?: string;
}

export interface LedgerEntry {
  date: string;
  description?: string;
  debit?: number;
  credit?: number;
  balance?: number;
}

const unwrap = <T>(res: { data: { data?: T } | T }): T =>
  (res.data as { data?: T }).data ?? (res.data as T);

export const customersService = {
  list: (limit = 500) =>
    api.get<{ data: Customer[] } | Customer[]>(`/customers?limit=${limit}`).then(unwrap<Customer[]>),

  get: (id: number) =>
    api.get<{ data: Customer } | Customer>(`/customers/${id}`).then(unwrap<Customer>),

  create: (data: CustomerPayload) =>
    api.post<Customer>("/customers", data).then((r) => r.data),

  update: (id: number, data: Partial<CustomerPayload>) =>
    api.patch<Customer>(`/customers/${id}`, data).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/customers/${id}`).then((r) => r.data),

  getLedger: (id: number) =>
    api.get<{ data: LedgerEntry[] } | LedgerEntry[]>(`/customers/${id}/ledger`).then(unwrap<LedgerEntry[]>),

  listPayments: () =>
    api.get<{ data: CustomerPayment[] } | CustomerPayment[]>("/customers/payments").then(unwrap<CustomerPayment[]>),

  createPayment: (data: CustomerPaymentPayload) =>
    api.post<CustomerPayment>("/customers/payments", data).then((r) => r.data),
};