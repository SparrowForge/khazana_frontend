import api from "@/lib/api";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface NcPayload {
  code?: string;
  date: string;
  name?: string;
  contactNo?: string;
  reference?: string;
  items: SaleItem[];
  netAmount: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=500").then(unwrap<AvailableItem[]>);

export const createNcAdjustment = (data: NcPayload) =>
  api.post("/nc-adjustment", data).then((r) => r.data);
