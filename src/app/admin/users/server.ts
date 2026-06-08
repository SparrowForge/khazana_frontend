import api from "@/lib/api";

export interface AdminUser {
  id: number;
  name?: string;
  userName: string;
  branchId: number;
  isActive?: string;
  branch?: { branchName: string };
}

export interface AdminUserPayload {
  name?: string;
  userName?: string;
  password?: string;
  branchId: number;
  isActive?: string;
}

export interface Branch {
  id: number;
  branchName: string;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchUsers = () =>
  api.get<{ data: AdminUser[] } | AdminUser[]>("/users").then(unwrap<AdminUser[]>);

export const createUser = (data: AdminUserPayload) =>
  api.post<AdminUser>("/users", data).then((r) => r.data);

export const updateUser = (id: number, data: Partial<AdminUserPayload>) =>
  api.patch<AdminUser>(`/users/${id}`, data).then((r) => r.data);

export const fetchBranches = () =>
  api.get<{ data: Branch[] } | Branch[]>("/admin/branches").then(unwrap<Branch[]>);
