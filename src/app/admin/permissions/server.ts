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
  api.get<{ data: Role[] } | Role[]>("/admin/roles").then(unwrap<Role[]>);

export const fetchMenus = () =>
  api.get<{ data: Menu[] } | Menu[]>("/admin/menus").then(unwrap<Menu[]>);

export const fetchPermissions = (roleId: string) =>
  api.get<{ data: Permission[] } | Permission[]>(`/admin/permissions?roleId=${roleId}`).then(unwrap<Permission[]>);

export const savePermissions = (roleId: string, permissions: Permission[]) =>
  api.post(`/admin/permissions/${roleId}`, permissions).then((r) => r.data);
