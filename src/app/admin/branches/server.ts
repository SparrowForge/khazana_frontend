import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Branch {
  /** Branch PK is a uuid (Int -> uuid migration), not a number. */
  id: string;
  branchCode: string;
  branchName: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
  /** Display position on the reports that show one column per branch. Lowest
   *  first; a branch without one sorts last. */
  sortingNo?: number | null;
}

export interface BranchPayload {
  branchCode: string;
  branchName: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
  sortingNo?: number;
}

export const fetchBranches = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Branch>> =>
  api.get(`/admin/branches?page=${page}&limit=${limit}`).then(unwrapPaginated<Branch>);

export const createBranch = (data: BranchPayload) =>
  api.post<Branch>("/admin/branches", data).then((r) => r.data);

export const updateBranch = (id: string, data: Partial<BranchPayload>) =>
  api.patch<Branch>(`/admin/branches/${id}`, data).then((r) => r.data);
