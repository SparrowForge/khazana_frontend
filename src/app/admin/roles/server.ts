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
  api.get<{ data: Role[] } | Role[]>("/roles").then(unwrap<Role[]>);

export const createRole = (data: RolePayload) =>
  api.post<Role>("/roles", data).then((r) => r.data);

export const updateRole = (id: number, data: Partial<RolePayload>) =>
  api.patch<Role>(`/roles/${id}`, data).then((r) => r.data);
