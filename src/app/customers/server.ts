import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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


export const fetchCustomers = (limit = 500) =>
  api.get<{ data: Customer[] } | Customer[]>(`/customers?limit=${limit}`).then(unwrapList<Customer>);

export const createCustomer = (data: CustomerPayload) =>
  api.post<Customer>("/customers", data).then((r) => r.data);

export const updateCustomer = (code: string, data: Partial<CustomerPayload>) =>
  api.patch<Customer>(`/customers/${code}`, data).then((r) => r.data);

export const deleteCustomer = (code: string) =>
  api.delete(`/customers/${code}`).then((r) => r.data);
