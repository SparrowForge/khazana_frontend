import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

// Units of measure. A lookup list the item forms read to fill their UOM
// dropdown — the unit itself is stored on the item as plain text, so this table
// says what may be PICKED, not what an item is bound to.

export interface Uom {
  id: string;
  /** The exact string written onto an item. Fixed once created. */
  code: string;
  name?: string;
  remarks?: string;
}

export interface UomPayload {
  code: string;
  name?: string;
  remarks?: string;
}

export const fetchUoms = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Uom>> =>
  api.get(`/uoms?page=${page}&limit=${limit}`).then(unwrapPaginated<Uom>);

/** Every unit, for a dropdown. The list is a handful of rows by nature. */
export const fetchAllUoms = (): Promise<Uom[]> =>
  api.get("/uoms?limit=100").then(unwrapList<Uom>);

export const createUom = (data: UomPayload) =>
  api.post<Uom>("/uoms", data).then((r) => r.data);

/** Name and remarks only — the code is what items already carry. */
export const updateUom = (id: string, data: Partial<Omit<UomPayload, "code">>) =>
  api.patch<Uom>(`/uoms/${id}`, data).then((r) => r.data);

export const deleteUom = (id: string) =>
  api.delete(`/uoms/${id}`).then((r) => r.data);
