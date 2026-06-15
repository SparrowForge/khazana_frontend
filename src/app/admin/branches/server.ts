import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Branch {
  id: number;
  branchCode: string;
  branchName: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
}

export interface BranchPayload {
  branchCode: string;
  branchName: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
}

export const fetchBranches = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Branch>> =>
  api.get(`/admin/branches?page=${page}&limit=${limit}`).then(unwrapPaginated<Branch>);

export const createBranch = (data: BranchPayload) =>
  api.post<Branch>("/admin/branches", data).then((r) => r.data);

export const updateBranch = (id: number, data: Partial<BranchPayload>) =>
  api.patch<Branch>(`/admin/branches/${id}`, data).then((r) => r.data);
