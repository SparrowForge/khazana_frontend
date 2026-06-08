import api from "@/lib/api";

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface RolePayload {
  name: string;
  description?: string;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchRoles = () =>
  api.get<{ data: Role[] } | Role[]>("/admin/roles").then(unwrap<Role[]>);

export const createRole = (data: RolePayload) =>
  api.post<Role>("/admin/roles", data).then((r) => r.data);

export const updateRole = (id: number, data: Partial<RolePayload>) =>
  api.patch<Role>(`/admin/roles/${id}`, data).then((r) => r.data);
