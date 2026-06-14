import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface StockItem {
  id: number;
  itemCode: string;
  item?: { itmName?: string; itmUOM?: string };
  quantity: number;
  unitCost: number;
  totalValue: number;
}


export const fetchStock = () =>
  api.get<{ data: StockItem[] } | StockItem[]>("/inventory").then(unwrapList<StockItem>);
