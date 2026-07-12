import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
}

export interface BranchOption {
  id: string;
  branchName: string;
}

export interface ReceivePayload {
  voucherNo?: string;
  purDate: string;
  fromBranchId?: string;
  items: { itemId: string; qty: number }[];
}

/** One row in the Stock Receive list — one per serial number, qty is the sum
 *  of every item line sharing that serial. */
export interface ReceiveRecord {
  id?: string;
  serialNo: string;
  voucharNo?: string;
  qty?: number;
  purDate?: string;
  branchId?: string;
  receiveBranchID?: string;
}

/** Full receive document for a serial number, with all its item lines. */
export interface ReceiveGroup {
  serialNo: string;
  voucherNo?: string;
  purDate?: string;
  branchId?: string;
  fromBranchId?: string;
  items: { itemId: string; itemName?: string; qty: number }[];
}

export interface UpdateReceivePayload {
  voucherNo?: string;
  purDate: string;
  fromBranchId?: string;
  branchId?: string;
  items: { itemId: string; itemName?: string; qty: number }[];
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchBranches = () =>
  api.get<{ data: BranchOption[] } | BranchOption[]>("/admin/branches?limit=100").then(unwrapList<BranchOption>);

export const receiveStock = (data: ReceivePayload) =>
  api.post("/inventory/receive", data).then((r) => r.data);

export const fetchReceives = ({ page = 1, limit = 10 } = {}): Promise<Paginated<ReceiveRecord>> =>
  api.get(`/inventory/receive/history?page=${page}&limit=${limit}`).then(unwrapPaginated<ReceiveRecord>);

export const fetchReceive = (serialNo: string): Promise<ReceiveGroup> =>
  api.get(`/inventory/receive/${encodeURIComponent(serialNo)}`).then((r) => r.data);

export const updateReceive = (serialNo: string, data: UpdateReceivePayload) =>
  api.patch(`/inventory/receive/${encodeURIComponent(serialNo)}`, data).then((r) => r.data);

export const deleteReceive = (serialNo: string) =>
  api.delete(`/inventory/receive/${encodeURIComponent(serialNo)}`).then((r) => r.data);
