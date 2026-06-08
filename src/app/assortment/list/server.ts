import api from "@/lib/api";

export interface Assortment {
  id: string;
  code?: string;
  date?: string;
  type?: string;
  netAmt?: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchAssortments = () =>
  api.get<{ data: Assortment[] } | Assortment[]>("/assortment").then(unwrap<Assortment[]>);
