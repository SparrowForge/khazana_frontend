import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchRoles = () =>
  api.get<{ data: Role[] } | Role[]>("/roles").then(unwrap<Role[]>);

export const fetchMenus = () =>
  api.get<{ data: Menu[] } | Menu[]>("/menus").then(unwrap<Menu[]>);

export const fetchPermissions = (roleId: string) =>
  api.get<{ data: Permission[] } | Permission[]>(`/permissions/role/${roleId}`).then(unwrap<Permission[]>);

export const savePermissions = (roleId: string, permissions: Permission[]) =>
  api.post(`/permissions/role/${roleId}/bulk`, { permissions }).then((r) => r.data);
