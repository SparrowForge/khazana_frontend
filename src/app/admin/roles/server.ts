import api from "@/lib/api";
import { unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface RolePayload {
  name: string;
  description?: string;
}

export const fetchRoles = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Role>> =>
  api.get(`/roles?page=${page}&limit=${limit}`).then(unwrapPaginated<Role>);

export const createRole = (data: RolePayload) =>
  api.post<Role>("/roles", data).then((r) => r.data);

export const updateRole = (id: number, data: Partial<RolePayload>) =>
  api.patch<Role>(`/roles/${id}`, data).then((r) => r.data);
