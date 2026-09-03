import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface StockItem {
  /** Item_Information.ID — the Inventory primary key since the uuid migration.
   *  Echoed as `id` by the list endpoint so table rows have a stable key. */
  id: string;
  itemId: string;
  item?: { itmCode?: string; itmName?: string; itmUOM?: string };
  quantity: number;
  unitCost: number;
  totalValue: number;
}

export const fetchStock = ({ page = 1, limit = 10 } = {}): Promise<Paginated<StockItem>> =>
  api.get(`/inventory?page=${page}&limit=${limit}`).then(unwrapPaginated<StockItem>);

/** Full stock list for Preview/Print/Export — /inventory is capped at limit=100
 *  per page server-side, so walk every page rather than just the one on screen. */
export const fetchAllStock = async (): Promise<StockItem[]> => {
  const all: StockItem[] = [];
  let page = 1;
  for (;;) {
    const { items, meta } = await fetchStock({ page, limit: 100 });
    all.push(...items);
    if (!meta.hasNextPage) break;
    page += 1;
  }
  return all;
};
