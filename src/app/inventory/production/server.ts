import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  /** t_Price.priceListPrice — VAT-EXCLUSIVE. */
  price?: number;
  /** t_Price.priceVatPercent, used to derive the VAT-inclusive rate. */
  vatPercentage?: number;
  /** On-hand qty from Inventory, shown for context (production adds to it). */
  stock?: number;
}

/** The rate a Production Entry records is the VAT-INCLUSIVE unit price, so the
 *  form pre-fills list price grossed up by the item's VAT percentage. */
export const vatInclusiveRate = (item?: Pick<AvailableItem, "price" | "vatPercentage">): number => {
  const price = Number(item?.price ?? 0);
  const vatPct = Number(item?.vatPercentage ?? 0);
  return Math.round(price * (1 + vatPct / 100) * 100) / 100;
};

export interface ProductionPayload {
  productionDate: string;
  remarks?: string;
  items: { itemId: string; qty: number; rate: number }[];
}

/** One row in the Production list — one per serial number; qty and totalValue
 *  are summed across every item line sharing that serial. */
export interface ProductionRecord {
  id?: string;
  serialNo: string;
  qty?: number;
  totalValue?: number;
  productionDate?: string;
  branchId?: string;
  remarks?: string;
}

/** Full production document for a serial number, with all its item lines. */
export interface ProductionGroup {
  serialNo: string;
  branchId?: string;
  productionDate?: string;
  remarks?: string;
  items: { itemId: string; itemName?: string; qty: number; rate?: number }[];
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchProductions = ({
  page = 1,
  limit = 10,
  fromDate,
  toDate,
}: { page?: number; limit?: number; fromDate?: string; toDate?: string } = {}): Promise<Paginated<ProductionRecord>> => {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("limit", String(limit));
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  return api.get(`/production?${params.toString()}`).then(unwrapPaginated<ProductionRecord>);
};

export const fetchProduction = (serialNo: string): Promise<ProductionGroup> =>
  api.get(`/production/${encodeURIComponent(serialNo)}`).then((r) => r.data);

export const createProduction = (data: ProductionPayload) =>
  api.post("/production", data).then((r) => r.data);

export const updateProduction = (serialNo: string, data: ProductionPayload) =>
  api.patch(`/production/${encodeURIComponent(serialNo)}`, data).then((r) => r.data);

export const deleteProduction = (serialNo: string) =>
  api.delete(`/production/${encodeURIComponent(serialNo)}`).then((r) => r.data);
