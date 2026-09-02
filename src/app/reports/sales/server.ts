import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface SalesReportRow {
  id: number;
  invNo?: string;
  date?: string;
  /** Who the sale was billed to. A counter sale names its picked customer now;
   *  a walk-in reads 'POS'. */
  customerName?: string;
  /** The customer's mobile — blank for a walk-in, and for a customer with no
   *  number on file. */
  contactNo?: string;
  totalAmount?: number;
  discount?: number;
  netAmount?: number;
  saleType?: string;
  /** Last 4 digits of the card on a Card counter sale; blank everywhere else. */
  cardNo?: string;
}


export const fetchSalesReport = (from: string, to: string) =>
  api.get<{ data: SalesReportRow[] } | SalesReportRow[]>(`/reports/sales?from=${from}&to=${to}`).then(unwrapList<SalesReportRow>);
