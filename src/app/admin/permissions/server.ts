import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface Role {
  id: number;
  name: string;
}

export interface Menu {
  id: number;
  menuName: string;
  controlName: string;
}

export interface Permission {
  menuId: number;
  isEnable: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}


export const fetchRoles = () =>
  api.get<{ data: Role[] } | Role[]>("/roles").then(unwrapList<Role>);

export const fetchMenus = () =>
  api.get<{ data: Menu[] } | Menu[]>("/menus").then(unwrapList<Menu>);

export const fetchPermissions = (roleId: string) =>
  api.get<{ data: Permission[] } | Permission[]>(`/permissions/role/${roleId}`).then(unwrapList<Permission>);

export const savePermissions = (roleId: string, permissions: Permission[]) =>
  api.post(`/permissions/role/${roleId}/bulk`, { permissions }).then((r) => r.data);
