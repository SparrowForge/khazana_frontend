import api from "@/lib/api";

export interface StockItem {
  id: number;
  itemCode: string;
  item?: { itmName?: string; itmUOM?: string };
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

const unwrap = <T>(res: { data: { data?: T } | T }): T =>
  (res.data as { data?: T }).data ?? (res.data as T);

export const inventoryService = {
  listStock: () =>
    api.get<{ data: StockItem[] } | StockItem[]>("/inventory").then(unwrap<StockItem[]>),

  receive: (data: ReceivePayload) =>
    api.post("/inventory/receive", data).then((r) => r.data),

  issue: (data: IssuePayload) =>
    api.post("/inventory/issue", data).then((r) => r.data),

  transfer: (data: TransferPayload) =>
    api.post("/inventory/transfer", data).then((r) => r.data),

  adjustment: (data: AdjustmentPayload) =>
    api.post("/inventory/adjustment", data).then((r) => r.data),
};
