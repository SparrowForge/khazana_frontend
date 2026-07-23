import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface NC {
  id: string;
  ncmstrCode?: string;
  ncmstrDate?: string;
  ncmstrName?: string;
  ncmstrContactNo?: string;
  ncmstrReference?: string;
}

export const fetchNcAdjustments = (fromDate?: string, toDate?: string): Promise<NC[]> => {
  const params = new URLSearchParams();
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  const query = params.toString();
  return api.get<{ data: NC[] } | NC[]>(`/nc-adjustment${query ? "?" + query : ""}`).then(unwrapList<NC>);
};

export const deleteNcAdjustment = (id: string) =>
  api.delete(`/nc-adjustment/${id}`).then((r) => r.data);
