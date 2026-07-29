import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface Assortment {
  id: string;
  code?: string;
  date?: string;
  type?: string;
  netAmt?: number;
}

/** The list is unpaginated on screen (it prints/exports as one sheet), so it
 *  asks for the backend's maximum page size within the chosen date range. */
export const fetchAssortments = ({ fromDate, toDate, limit = 100 }: { fromDate?: string; toDate?: string; limit?: number } = {}) => {
  const params = new URLSearchParams({ page: "1", limit: String(limit) });
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  return api.get<{ data: Assortment[] } | Assortment[]>(`/assortment?${params.toString()}`).then(unwrapList<Assortment>);
};

export const deleteAssortment = (id: string) =>
  api.delete(`/assortment/${id}`).then((r) => r.data);
