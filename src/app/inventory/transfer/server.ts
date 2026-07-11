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

export interface TransferPayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: string;
  receiveBranchId: string;
  items: { itemCode: string; qty: number }[];
}

export interface TransferRecord {
  id: string;
  voucharNo?: string;
  itemCode?: string;
  qty?: number;
  issueDate?: string;
  issueBranchId?: string;
  receiveBranchId?: string;
}

export interface UpdateTransferPayload {
  voucherNo?: string;
  issueDate?: string;
  issueBranchId?: string;
  receiveBranchId?: string;
  itemCode?: string;
  qty?: number;
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchBranches = () =>
  api.get<{ data: BranchOption[] } | BranchOption[]>("/admin/branches").then(unwrapList<BranchOption>);

export const transferStock = (data: TransferPayload) =>
  api.post("/inventory/transfer", data).then((r) => r.data);

export const fetchTransfers = ({ page = 1, limit = 10 } = {}): Promise<Paginated<TransferRecord>> =>
  api.get(`/inventory/transfer?page=${page}&limit=${limit}`).then(unwrapPaginated<TransferRecord>);

export const fetchTransfer = (id: string): Promise<TransferRecord> =>
  api.get(`/inventory/transfer/${id}`).then((r) => r.data);

export const updateTransfer = (id: string, data: UpdateTransferPayload) =>
  api.patch(`/inventory/transfer/${id}`, data).then((r) => r.data);

export const deleteTransfer = (id: string) =>
  api.delete(`/inventory/transfer/${id}`).then((r) => r.data);
