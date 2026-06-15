import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface AdminUser {
  id: string;
  name?: string;
  userName: string;
  email?: string;
  branchId: string;
  isActive?: string;
  isVerified?: boolean;
  branch?: { branchName: string };
}

export interface AdminUserPayload {
  name?: string;
  userName?: string;
  email?: string;
  password?: string;
  branchId: string;
  isActive?: string;
}

export interface Branch {
  id: string;
  branchName: string;
}

export const fetchUsers = ({ page = 1, limit = 10 } = {}): Promise<Paginated<AdminUser>> =>
  api.get(`/users?page=${page}&limit=${limit}`).then(unwrapPaginated<AdminUser>);

export const createUser = (data: AdminUserPayload) =>
  api.post<AdminUser>("/users", data).then((r) => r.data);

export const updateUser = (id: string, data: Partial<AdminUserPayload>) =>
  api.patch<AdminUser>(`/users/${id}`, data).then((r) => r.data);

export const fetchBranches = (): Promise<Branch[]> =>
  api.get("/admin/branches").then(unwrapList<Branch>);
