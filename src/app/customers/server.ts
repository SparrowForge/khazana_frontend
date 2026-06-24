import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

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

export const fetchCustomers = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Customer>> =>
  api.get(`/customers?page=${page}&limit=${limit}`).then(unwrapPaginated<Customer>);

export const fetchAllCustomers = (limit = 500): Promise<Customer[]> =>
  api.get(`/customers?limit=${limit}`).then(unwrapList<Customer>);

export const createCustomer = (data: CustomerPayload) =>
  api.post<Customer>("/customers", data).then((r) => r.data);

export const updateCustomer = (code: string, data: Partial<CustomerPayload>) => {
  // `code` is the path identifier and the primary key — it must not be in the body.
  // The backend UpdateCustomerDto doesn't whitelist it, so sending it returns a 400.
  const body = { ...data };
  delete body.code;
  return api.patch<Customer>(`/customers/${code}`, body).then((r) => r.data);
};

export const deleteCustomer = (code: string) =>
  api.delete(`/customers/${code}`).then((r) => r.data);
