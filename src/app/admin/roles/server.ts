import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface RolePayload {
  name: string;
  description?: string;
}


export const fetchRoles = () =>
  api.get<{ data: Role[] } | Role[]>("/roles").then(unwrapList<Role>);

export const createRole = (data: RolePayload) =>
  api.post<Role>("/roles", data).then((r) => r.data);

export const updateRole = (id: number, data: Partial<RolePayload>) =>
  api.patch<Role>(`/roles/${id}`, data).then((r) => r.data);
