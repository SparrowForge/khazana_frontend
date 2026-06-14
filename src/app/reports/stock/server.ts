import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface StockRow {
  id: number;
  itemCode?: string;
  itemName?: string;
  uom?: string;
  openingQty?: number;
  inwardQty?: number;
  outwardQty?: number;
  closingQty?: number;
}


export const fetchStockReport = () =>
  api.get<{ data: StockRow[] } | StockRow[]>("/reports/stock").then(unwrapList<StockRow>);
