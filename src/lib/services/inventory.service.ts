import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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

export interface ReceivePayload {
  voucherNo?: string;
  purDate: string;
  items: { itemCode: string; qty: number }[];
}

export interface IssuePayload {
  voucherNo?: string;
  issueDate: string;
  items: { itemCode: string; qty: number }[];
}

export interface TransferPayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: number;
  receiveBranchId: number;
  items: { itemCode: string; qty: number }[];
}

export interface AdjustmentItem {
  itmOId: number;
  reject: number;
  excess: number;
  short: number;
  assort: number;
}

export interface AdjustmentPayload {
  invNo?: string;
  date: string;
  items: AdjustmentItem[];
}


/** One item's on-hand quantity, as returned by GET /inventory/stock-levels. */
export interface StockLevel {
  itemId: string;
  itemCode: string;
  quantity: number;
}

/** On-hand quantity of every item, keyed by item UUID.
 *
 *  The compact companion to the priced catalogue: screens that gate lines on
 *  stock (the POS terminal, the credit-sale forms) re-read this on a timer so a
 *  sale rung on another till, or a factory issue/receive/adjustment, lands on
 *  screen without a reload. An item with no Inventory row is absent from the
 *  map, which callers read as zero — the same thing the catalogue reports. */
export const fetchStockLevels = (): Promise<Record<string, number>> =>
  api.get<StockLevel[]>("/inventory/stock-levels").then((r) => {
    const levels: Record<string, number> = {};
    for (const row of r.data ?? []) levels[row.itemId] = Number(row.quantity ?? 0);
    return levels;
  });

export const inventoryService = {
  listStock: () =>
    api.get<{ data: StockItem[] } | StockItem[]>("/inventory").then(unwrapList<StockItem>),

  receive: (data: ReceivePayload) =>
    api.post("/inventory/receive", data).then((r) => r.data),

  issue: (data: IssuePayload) =>
    api.post("/inventory/issue", data).then((r) => r.data),

  transfer: (data: TransferPayload) =>
    api.post("/inventory/transfer", data).then((r) => r.data),

  adjustment: (data: AdjustmentPayload) =>
    api.post("/inventory/adjustment", data).then((r) => r.data),
};
