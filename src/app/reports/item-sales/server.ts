import api from "@/lib/api";

export interface ItemSalesRow {
  id: number;
  itemCode?: string;
  itemName?: string;
  uom?: string;
  totalQty?: number;
  totalAmount?: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchItemSalesReport = (from: string, to: string) =>
  api.get<{ data: ItemSalesRow[] } | ItemSalesRow[]>(`/reports/item-sales?from=${from}&to=${to}`).then(unwrap<ItemSalesRow[]>);
