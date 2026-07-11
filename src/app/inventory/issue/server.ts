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

export interface IssuePayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: string;
  receiveBranchId: string;
  items: { itemCode: string; qty: number; unitPrice: number }[];
}

export interface IssueRecord {
  id: string;
  serialNo?: string;
  voucharNo?: string;
  itemCode?: string;
  qty?: number;
  unitPrice?: number;
  issueDate?: string;
  issueBranchId?: string;
  receiveBranchId?: string;
}

export interface UpdateIssuePayload {
  voucherNo?: string;
  issueDate?: string;
  issueBranchId?: string;
  receiveBranchId?: string;
  itemCode?: string;
  qty?: number;
  unitPrice?: number;
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchBranches = () =>
  api.get<{ data: BranchOption[] } | BranchOption[]>("/admin/branches?limit=100").then(unwrapList<BranchOption>);

export const issueStock = (data: IssuePayload) =>
  api.post("/inventory/issue", data).then((r) => r.data);

export const fetchIssues = ({ page = 1, limit = 10 } = {}): Promise<Paginated<IssueRecord>> =>
  api.get(`/inventory/issue/history?page=${page}&limit=${limit}`).then(unwrapPaginated<IssueRecord>);

export const fetchIssue = (id: string): Promise<IssueRecord> =>
  api.get(`/inventory/issue/${id}`).then((r) => r.data);

export const updateIssue = (id: string, data: UpdateIssuePayload) =>
  api.patch(`/inventory/issue/${id}`, data).then((r) => r.data);

export const deleteIssue = (id: string) =>
  api.delete(`/inventory/issue/${id}`).then((r) => r.data);
