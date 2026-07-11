import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface AvailableItem {
  id: number;
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
  items: { itemCode: string; qty: number }[];
}

export interface ReceiveRecord {
  id: string;
  serialNo?: string;
  voucharNo?: string;
  itemCode?: string;
  itemName?: string;
  qty?: number;
  purDate?: string;
  branchId?: string;
  receiveBranchID?: string;
}

export interface UpdateReceivePayload {
  voucherNo?: string;
  purDate?: string;
  fromBranchId?: string;
  branchId?: string;
  itemCode?: string;
  qty?: number;
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchBranches = () =>
  api.get<{ data: BranchOption[] } | BranchOption[]>("/admin/branches?limit=100").then(unwrapList<BranchOption>);

export const receiveStock = (data: ReceivePayload) =>
  api.post("/inventory/receive", data).then((r) => r.data);

export const fetchReceives = ({ page = 1, limit = 10 } = {}): Promise<Paginated<ReceiveRecord>> =>
  api.get(`/inventory/receive/history?page=${page}&limit=${limit}`).then(unwrapPaginated<ReceiveRecord>);

export const fetchReceive = (id: string): Promise<ReceiveRecord> =>
  api.get(`/inventory/receive/${id}`).then((r) => r.data);

export const updateReceive = (id: string, data: UpdateReceivePayload) =>
  api.patch(`/inventory/receive/${id}`, data).then((r) => r.data);

export const deleteReceive = (id: string) =>
  api.delete(`/inventory/receive/${id}`).then((r) => r.data);
