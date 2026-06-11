import api from "@/lib/api";

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

// Handles both paginated { data: { items: [] } } and legacy { data: [] } envelopes
function extractItems<T>(res: { data: Record<string, unknown> }): T[] {
  const d = res.data;
  const nested = d?.data as Record<string, unknown> | undefined;
  if (nested?.items && Array.isArray(nested.items)) return nested.items as T[];
  if (Array.isArray(nested)) return nested as T[];
  if (Array.isArray(d)) return d as unknown as T[];
  return [];
}

export const fetchUsers = () =>
  api.get("/users").then((r) => extractItems<AdminUser>(r));

export const createUser = (data: AdminUserPayload) =>
  api.post<AdminUser>("/users", data).then((r) => r.data);

export const updateUser = (id: string, data: Partial<AdminUserPayload>) =>
  api.patch<AdminUser>(`/users/${id}`, data).then((r) => r.data);

export const fetchBranches = () =>
  api.get("/admin/branches").then((r) => extractItems<Branch>(r));
