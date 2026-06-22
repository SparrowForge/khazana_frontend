import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface AdminUser {
  id: string;
  name?: string;
  userName: string;
  email?: string;
  isActive?: string;
  isVerified?: boolean;
  branchMappings?: { branch: { id: string; branchName: string | null; branchCode: string | null } }[];
}

export interface AdminUserPayload {
  name?: string;
  userName?: string;
  email?: string;
  password?: string;
  branchIds: string[];
  isActive?: string;
}

export interface Branch {
  id: string;
  branchName: string | null;
  branchCode: string | null;
}

export const fetchUsers = ({ page = 1, limit = 10 } = {}): Promise<Paginated<AdminUser>> =>
  api.get(`/users?page=${page}&limit=${limit}`).then(unwrapPaginated<AdminUser>);

export const createUser = (data: AdminUserPayload) =>
  api.post<AdminUser>("/users", data).then((r) => r.data);

export const updateUser = (id: string, data: Partial<AdminUserPayload>) =>
  api.patch<AdminUser>(`/users/${id}`, data).then((r) => r.data);

export const fetchBranches = (): Promise<Branch[]> =>
  api.get("/admin/branches").then((r) => {
    const body = r.data;
    // Handles both paginated { items: [] } and plain array responses
    return Array.isArray(body) ? body : (body?.items ?? []);
  });
