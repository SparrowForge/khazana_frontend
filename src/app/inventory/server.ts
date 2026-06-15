import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface StockItem {
  id: number;
  itemCode: string;
  item?: { itmName?: string; itmUOM?: string };
  quantity: number;
  unitCost: number;
  totalValue: number;
}

export const fetchStock = ({ page = 1, limit = 10 } = {}): Promise<Paginated<StockItem>> =>
  api.get(`/inventory?page=${page}&limit=${limit}`).then(unwrapPaginated<StockItem>);
