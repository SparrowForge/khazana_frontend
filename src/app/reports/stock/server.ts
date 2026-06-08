import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchStockReport = () =>
  api.get<{ data: StockRow[] } | StockRow[]>("/reports/stock").then(unwrap<StockRow[]>);
