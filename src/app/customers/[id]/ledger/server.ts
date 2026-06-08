import api from "@/lib/api";

export interface CustomerInfo {
  code: string;
  name: string;
}

export interface LedgerEntry {
  id: number;
  date?: string;
  description?: string;
  debit?: number;
  credit?: number;
  balance?: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchCustomer = (id: string | string[]) =>
  api.get<CustomerInfo>(`/customers/${id}`).then((r) => r.data);

export const fetchLedger = (id: string | string[]) =>
  api.get<{ data: LedgerEntry[] } | LedgerEntry[]>(`/customers/${id}/ledger`).then(unwrap<LedgerEntry[]>);
