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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchCustomers = (limit = 500) =>
  api.get<{ data: Customer[] } | Customer[]>(`/customers?limit=${limit}`).then(unwrap<Customer[]>);

export const createCustomer = (data: CustomerPayload) =>
  api.post<Customer>("/customers", data).then((r) => r.data);

export const updateCustomer = (code: string, data: Partial<CustomerPayload>) =>
  api.patch<Customer>(`/customers/${code}`, data).then((r) => r.data);

export const deleteCustomer = (code: string) =>
  api.delete(`/customers/${code}`).then((r) => r.data);
