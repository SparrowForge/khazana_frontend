import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchBranches = () =>
  api.get<{ data: Branch[] } | Branch[]>("/admin/branches").then(unwrap<Branch[]>);

export const createBranch = (data: BranchPayload) =>
  api.post<Branch>("/admin/branches", data).then((r) => r.data);

export const updateBranch = (id: number, data: Partial<BranchPayload>) =>
  api.patch<Branch>(`/admin/branches/${id}`, data).then((r) => r.data);
