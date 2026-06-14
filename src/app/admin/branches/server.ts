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

export const fetchBranches = () =>
  api.get<{ data: { items: Branch[] } }>("/admin/branches").then((r) => r.data.data.items ?? []);

export const createBranch = (data: BranchPayload) =>
  api.post<Branch>("/admin/branches", data).then((r) => r.data);

export const updateBranch = (id: number, data: Partial<BranchPayload>) =>
  api.patch<Branch>(`/admin/branches/${id}`, data).then((r) => r.data);
