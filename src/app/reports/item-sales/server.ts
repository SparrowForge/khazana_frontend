import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface ItemSalesRow {
  id: number;
  itemCode?: string;
  itemName?: string;
  uom?: string;
  totalQty?: number;
  totalAmount?: number;
}


export const fetchItemSalesReport = (from: string, to: string) =>
  api.get<{ data: ItemSalesRow[] } | ItemSalesRow[]>(`/reports/item-sales?from=${from}&to=${to}`).then(unwrapList<ItemSalesRow>);
