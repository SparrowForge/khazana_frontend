import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

/** A customer offered in the report's Customer filter. */
export interface NCReportCustomer {
  id: string;
  code: string;
  name: string;
}

export interface NCReportRow {
  date: string;
  invoiceNo: string;
  itemName: string;
  uom: string;
  qty: number;
  /** VAT-inclusive line value. */
  amount: number;
  name: string;
  reference: string;
  outlet: string;
}

export interface NCReport {
  fromDate: string;
  toDate: string;
  branch: { id: string; name: string };
  /** The customer the sheet was run for, or the "All Customers" placeholder. */
  customer: { id: string; code: string; name: string };
  items: NCReportRow[];
  totals: { qty: number; amount: number };
}

export const fetchCustomers = () =>
  api.get<{ data: NCReportCustomer[] } | NCReportCustomer[]>("/customers?limit=100").then(unwrapList<NCReportCustomer>);

// Date range [fromDate, toDate] (inclusive). `branchId` omitted aggregates every
// branch; `customerId` omitted covers every customer. Filtering by customer only
// matches NCs that carry the link — ones entered before customers were picked on
// the NC screen have a typed name and no CustomerID.
export const fetchNCReport = (fromDate: string, toDate: string, branchId?: string, customerId?: string) => {
  const params = new URLSearchParams({ fromDate, toDate });
  if (branchId) params.append("branchId", branchId);
  if (customerId) params.append("customerId", customerId);
  return api.get<NCReport>(`/reports/nc?${params.toString()}`).then((r) => r.data);
};
