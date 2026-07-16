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

export interface TransferPayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: string;
  receiveBranchId: string;
  items: { itemId: string; qty: number }[];
}

/** One row in the Stock Transfer list — one per serial number, qty is the sum
 *  of every item line sharing that serial. */
export interface TransferRecord {
  id?: string;
  serialNo: string;
  voucharNo?: string;
  qty?: number;
  issueDate?: string;
  issueBranchId?: string;
  receiveBranchId?: string;
}

/** Full transfer document for a serial number, with all its item lines. */
export interface TransferGroup {
  serialNo: string;
  voucherNo?: string;
  issueDate?: string;
  issueBranchId?: string;
  receiveBranchId?: string;
  items: { itemId: string; itemName?: string; qty: number }[];
}

export interface UpdateTransferPayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: string;
  receiveBranchId: string;
  items: { itemId: string; qty: number }[];
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchBranches = () =>
  api.get<{ data: BranchOption[] } | BranchOption[]>("/admin/branches").then(unwrapList<BranchOption>);

export const transferStock = (data: TransferPayload) =>
  api.post("/inventory/transfer", data).then((r) => r.data);

export const fetchTransfers = ({ page = 1, limit = 10 } = {}): Promise<Paginated<TransferRecord>> =>
  api.get(`/inventory/transfer?page=${page}&limit=${limit}`).then(unwrapPaginated<TransferRecord>);

export const fetchTransfer = (serialNo: string): Promise<TransferGroup> =>
  api.get(`/inventory/transfer/${encodeURIComponent(serialNo)}`).then((r) => r.data);

export const updateTransfer = (serialNo: string, data: UpdateTransferPayload) =>
  api.patch(`/inventory/transfer/${encodeURIComponent(serialNo)}`, data).then((r) => r.data);

export const deleteTransfer = (serialNo: string) =>
  api.delete(`/inventory/transfer/${encodeURIComponent(serialNo)}`).then((r) => r.data);
