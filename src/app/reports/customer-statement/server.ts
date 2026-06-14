import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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


export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers?limit=500").then(unwrapList<Customer>);

export const fetchCustomerStatement = (from: string, to: string, customerCode: string) =>
  api.get<{ data: StatementRow[] } | StatementRow[]>(`/reports/customer-statement?from=${from}&to=${to}&customerCode=${customerCode}`)
    .then(unwrapList<StatementRow>);
