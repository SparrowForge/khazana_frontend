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

/** One item line of an issue. `isProduction` also records the line in
 *  Production (same item and qty) — factory sessions only; the API refuses it
 *  from any other branch. */
export interface IssueLinePayload {
  itemId: string;
  qty: number;
  unitPrice?: number;
  isProduction?: boolean;
}

export interface IssuePayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: string;
  receiveBranchId: string;
  items: IssueLinePayload[];
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
  items: { itemId: string; itemName?: string; qty: number; unitPrice?: number; isProduction?: boolean }[];
}

export interface UpdateIssuePayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: string;
  receiveBranchId: string;
  items: IssueLinePayload[];
}

/** The entry grid lists the whole catalogue, but the shared pagination DTO caps
 *  `limit` at 100 — so walk the pages until one comes back short rather than
 *  silently showing only the first hundred items.
 *
 *  No `isActive` filter: the backend matches that column as an exact string, so
 *  anything stored as null, lowercase or 'N' would vanish from the grid. The
 *  issue sheet has to list every item, so the filter is left off entirely. */
export const fetchItems = async (): Promise<AvailableItem[]> => {
  const PAGE_SIZE = 100;
  const all: AvailableItem[] = [];
  for (let page = 1; ; page++) {
    const batch = await api
      .get<{ data: AvailableItem[] } | AvailableItem[]>(`/inventory/items?page=${page}&limit=${PAGE_SIZE}`)
      .then(unwrapList<AvailableItem>);
    all.push(...batch);
    // A short page is the last one; the guard stops a malformed response (an
    // endpoint that ignores `page`) from looping forever.
    if (batch.length < PAGE_SIZE || page >= 50) break;
  }
  return all;
};

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
