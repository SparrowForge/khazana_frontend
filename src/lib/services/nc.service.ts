import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
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


export const ncService = {
  list: () =>
    api.get<{ data: NcAdjustment[] } | NcAdjustment[]>("/nc").then(unwrapList<NcAdjustment>),

  create: (data: NcPayload) =>
    api.post("/nc", data).then((r) => r.data),
};
