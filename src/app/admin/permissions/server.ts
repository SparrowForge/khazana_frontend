import api from "@/lib/api";
import { unwrapPaginated } from "@/lib/unwrap";

export interface Role {
  id: string;
  name: string;
}

export interface Menu {
  id: string;
  menuName: string;
  controlName: string;
  parentMenu: string | null;
}

export interface Permission {
  menuId: string;
  isEnable: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export const fetchRoles = (): Promise<Role[]> =>
  api.get("/roles?page=1&limit=100").then(unwrapPaginated<Role>).then((r) => r.items);

export const fetchMenus = (): Promise<Menu[]> =>
  api.get("/menus?page=1&limit=100").then(unwrapPaginated<Menu>).then((r) => r.items);

export const fetchPermissions = (roleId: string): Promise<Permission[]> =>
  api.get(`/permissions/role/${roleId}`).then((r) => r.data ?? []);

/** Sync-save: PUT replaces all permissions for the role in one transaction. */
export const savePermissions = (roleId: string, permissions: Permission[]) =>
  api.put(`/permissions/role/${roleId}`, { permissions }).then((r) => r.data);
