import api from "@/lib/api";
import { SaleItem } from "@/types";

export interface NcAdjustment {
  id: number;
  code?: string;
  date?: string;
  name?: string;
  contactNo?: string;
  reference?: string;
  netAmount?: number;
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

const unwrap = <T>(res: { data: { data?: T } | T }): T =>
  (res.data as { data?: T }).data ?? (res.data as T);

export const ncService = {
  list: () =>
    api.get<{ data: NcAdjustment[] } | NcAdjustment[]>("/nc").then(unwrap<NcAdjustment[]>),

  create: (data: NcPayload) =>
    api.post("/nc", data).then((r) => r.data),
};
