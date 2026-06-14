import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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

export const fetchCustomer = (id: string | string[]) =>
  api.get<CustomerInfo>(`/customers/${id}`).then((r) => r.data);

export const fetchLedger = (id: string | string[]) =>
  api.get<{ data: { items: LedgerEntry[] } }>(`/customers/${id}/ledger`).then(unwrapList<LedgerEntry>);
