import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { emitStockChanged } from "@/lib/stockEvents";

/** Detail rows come back with the master so the list can show (and export) each
 *  NC's value without a second round-trip per row. */
export interface NCDetailRow {
  ncdetQTY?: number | string | null;
  ncdetVATAmount?: number | string | null;
  ncdetNetAmount?: number | string | null;
}

export interface NC {
  id: string;
  ncmstrCode?: string;
  ncmstrDate?: string;
  ncmstrName?: string;
  ncmstrContactNo?: string;
  ncmstrReference?: string;
  details?: NCDetailRow[];
}

/** The list is unpaginated on screen (it prints/exports as one sheet), so it
 *  asks for the backend's maximum page size within the chosen date range. */
export const fetchNcAdjustments = (fromDate?: string, toDate?: string, limit = 100): Promise<NC[]> => {
  const params = new URLSearchParams({ page: "1", limit: String(limit) });
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  return api.get<{ data: NC[] } | NC[]>(`/nc-adjustment?${params.toString()}`).then(unwrapList<NC>);
};

/** Value of the goods on an NC: line totals (discount already netted off) plus
 *  their VAT — the same figure its invoice prints as "Total Value". */
export const ncTotalValue = (nc: NC): number =>
  (nc.details ?? []).reduce(
    (sum, d) => sum + Number(d.ncdetNetAmount ?? 0) + Number(d.ncdetVATAmount ?? 0),
    0,
  );

export const ncTotalQty = (nc: NC): number =>
  (nc.details ?? []).reduce((sum, d) => sum + Number(d.ncdetQTY ?? 0), 0);

export const deleteNcAdjustment = (id: string) =>
  api.delete(`/nc-adjustment/${id}`).then((r) => { emitStockChanged("nc:delete"); return r.data; });
