import api from "@/lib/api";

export interface StockItem {
  id: number;
  itemCode: string;
  item?: { itmName?: string; itmUOM?: string };
  quantity: number;
  unitCost: number;
  totalValue: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchStock = () =>
  api.get<{ data: StockItem[] } | StockItem[]>("/inventory").then(unwrap<StockItem[]>);
