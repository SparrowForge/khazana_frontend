import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
  /** On-hand qty from Inventory — an issue may not drive it negative. */
  stock?: number;
}

export interface BranchOption {
  id: string;
  branchName: string;
}

export interface IssuePayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: string;
  receiveBranchId: string;
  items: { itemId: string; qty: number; unitPrice: number }[];
}

/** One row in the Stock Issue list — one per serial number, qty is the sum
 *  of every item line sharing that serial. */
export interface IssueRecord {
  id?: string;
  serialNo: string;
  voucharNo?: string;
  qty?: number;
  issueDate?: string;
  issueBranchId?: string;
  receiveBranchId?: string;
}

/** Full issue document for a serial number, with all its item lines. */
export interface IssueGroup {
  serialNo: string;
  voucherNo?: string;
  issueDate?: string;
  issueBranchId?: string;
  receiveBranchId?: string;
  items: { itemId: string; itemName?: string; qty: number; unitPrice?: number }[];
}

export interface UpdateIssuePayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: string;
  receiveBranchId: string;
  items: { itemId: string; qty: number; unitPrice?: number }[];
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchBranches = () =>
  api.get<{ data: BranchOption[] } | BranchOption[]>("/admin/branches?limit=100").then(unwrapList<BranchOption>);

export const issueStock = (data: IssuePayload) =>
  api.post("/inventory/issue", data).then((r) => r.data);

export const fetchIssues = ({ page = 1, limit = 10, fromDate, toDate, branchId }: { page?: number; limit?: number; fromDate?: string; toDate?: string; branchId?: string } = {}): Promise<Paginated<IssueRecord>> => {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("limit", String(limit));
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  if (branchId) params.append("branchId", branchId);
  return api.get(`/inventory/issue/history?${params.toString()}`).then(unwrapPaginated<IssueRecord>);
};

export const fetchIssue = (serialNo: string): Promise<IssueGroup> =>
  api.get(`/inventory/issue/${encodeURIComponent(serialNo)}`).then((r) => r.data);

export const updateIssue = (serialNo: string, data: UpdateIssuePayload) =>
  api.patch(`/inventory/issue/${encodeURIComponent(serialNo)}`, data).then((r) => r.data);

export const deleteIssue = (serialNo: string) =>
  api.delete(`/inventory/issue/${encodeURIComponent(serialNo)}`).then((r) => r.data);
