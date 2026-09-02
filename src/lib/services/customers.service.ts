import api from "@/lib/api";
import { unwrap, unwrapList } from "@/lib/unwrap";

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


export const customersService = {
  list: (limit = 100) =>
    api.get<{ data: Customer[] } | Customer[]>(`/customers?limit=${limit}`).then(unwrapList<Customer>),

  get: (id: number) =>
    api.get<{ data: Customer } | Customer>(`/customers/${id}`).then(unwrap<Customer>),

  create: (data: CustomerPayload) =>
    api.post<Customer>("/customers", data).then((r) => r.data),

  update: (id: number, data: Partial<CustomerPayload>) =>
    api.patch<Customer>(`/customers/${id}`, data).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/customers/${id}`).then((r) => r.data),

  getLedger: (id: number) =>
    api.get<{ data: LedgerEntry[] } | LedgerEntry[]>(`/customers/${id}/ledger`).then(unwrapList<LedgerEntry>),

  listPayments: () =>
    api.get<{ data: CustomerPayment[] } | CustomerPayment[]>("/customers/payments").then(unwrapList<CustomerPayment>),

  createPayment: (data: CustomerPaymentPayload) =>
    api.post<CustomerPayment>("/customers/payments", data).then((r) => r.data),
};