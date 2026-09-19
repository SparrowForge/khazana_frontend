import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Customer {
  id: number;
  code: string;
  name: string;
  mobile?: string;
  address?: string;
  email?: string;
  /** Standing discount % agreed with this customer. Seeds — but does not fix —
   *  the invoice-level discount of a credit sale raised for them. Decimal
   *  columns can arrive as strings. */
  defaultDiscount?: number | string | null;
}

export interface CustomerPayload {
  /** Omitted on create — the backend allocates the next C-nnnn. */
  code?: string;
  name: string;
  mobile?: string;
  address?: string;
  email?: string;
  defaultDiscount?: number;
}

/** `search` matches code, name or contact no, and is applied by the server
 *  before paging — filtering the fetched page instead would only ever search
 *  the rows already on screen. */
export const fetchCustomers = ({ page = 1, limit = 10, search = "" } = {}): Promise<Paginated<Customer>> => {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) qs.set("search", search.trim());
  return api.get(`/customers?${qs}`).then(unwrapPaginated<Customer>);
};

/** The whole customer book, for the exports and for any picker that wants it.
 *  Not `/customers?limit=500`: that route is paginated and caps limit at 100,
 *  so the larger page size was rejected and the exports came back empty. */
export const fetchAllCustomers = (limit = 500): Promise<Customer[]> =>
  api.get(`/customers/options?limit=${limit}`).then(unwrapList<Customer>);

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
