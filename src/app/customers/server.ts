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
  /** Omitted on create — the backend allocates the next C-nnnn. */
  code?: string;
  name: string;
  mobile?: string;
  address?: string;
  email?: string;
}

export const fetchCustomers = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Customer>> =>
  api.get(`/customers?page=${page}&limit=${limit}`).then(unwrapPaginated<Customer>);

export const fetchAllCustomers = (limit = 500): Promise<Customer[]> =>
  api.get(`/customers?limit=${limit}`).then(unwrapList<Customer>);

export const createCustomer = (data: CustomerPayload) => {
  // The code is allocated server-side; the form's field is display-only and
  // blank until then, so it is left out rather than posted empty.
  const body = { ...data };
  if (!body.code) delete body.code;
  return api.post<Customer>("/customers", body).then((r) => r.data);
};

export const updateCustomer = (code: string, data: Partial<CustomerPayload>) => {
  // `code` is the path identifier and the primary key — it must not be in the body.
  // The backend UpdateCustomerDto doesn't whitelist it, so sending it returns a 400.
  const body = { ...data };
  delete body.code;
  return api.patch<Customer>(`/customers/${code}`, body).then((r) => r.data);
};

export const deleteCustomer = (code: string) =>
  api.delete(`/customers/${code}`).then((r) => r.data);
