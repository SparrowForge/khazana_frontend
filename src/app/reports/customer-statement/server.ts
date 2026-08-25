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

/** The statement is a ledger, not a flat list: it opens with the balance
 *  carried in from before the range and closes with the period totals. */
export interface CustomerStatement {
  customer?: { id?: string; code?: string; name?: string };
  openingBalance: number;
  items: StatementRow[];
  totals: { debit: number; credit: number; closingBalance: number };
}

const EMPTY_STATEMENT: CustomerStatement = {
  openingBalance: 0,
  items: [],
  totals: { debit: 0, credit: 0, closingBalance: 0 },
};

export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers?limit=100").then(unwrapList<Customer>);

export const fetchCustomerStatement = (from: string, to: string, customerCode: string) =>
  api
    .get<CustomerStatement | { data: CustomerStatement }>(
      `/reports/customer-statement?from=${from}&to=${to}&customerCode=${customerCode}`,
    )
    .then((r) => {
      const body = r.data as CustomerStatement & { data?: CustomerStatement };
      const s = body?.data ?? body;
      if (!s || !Array.isArray(s.items)) return EMPTY_STATEMENT;
      return {
        customer: s.customer,
        openingBalance: s.openingBalance ?? 0,
        items: s.items,
        totals: s.totals ?? { debit: 0, credit: 0, closingBalance: s.openingBalance ?? 0 },
      };
    });
