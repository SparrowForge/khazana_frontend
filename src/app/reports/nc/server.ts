import api from "@/lib/api";

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
  items: NCReportRow[];
  totals: { qty: number; amount: number };
}

// Date range [fromDate, toDate] (inclusive). `branchId` omitted aggregates every branch.
export const fetchNCReport = (fromDate: string, toDate: string, branchId?: string) =>
  api
    .get<NCReport>(`/reports/nc?fromDate=${fromDate}&toDate=${toDate}${branchId ? `&branchId=${branchId}` : ""}`)
    .then((r) => r.data);
