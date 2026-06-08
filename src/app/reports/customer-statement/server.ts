import api from "@/lib/api";

export interface Customer {
  id: number;
  code: string;
  name: string;
}

export interface StatementRow {
  id: number;
  date?: string;
  description?: string;
  invoiceNo?: string;
  debit?: number;
  credit?: number;
  balance?: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers?limit=500").then(unwrap<Customer[]>);

export const fetchCustomerStatement = (from: string, to: string, customerCode: string) =>
  api.get<{ data: StatementRow[] } | StatementRow[]>(`/reports/customer-statement?from=${from}&to=${to}&customerCode=${customerCode}`)
    .then(unwrap<StatementRow[]>);
