import api from "@/lib/api";
import { unwrapPaginated } from "@/lib/unwrap";

export interface UserItem {
  id: string;
  userName: string;
  name: string | null;
  isActive: string | null;
}

export interface Menu {
  id: string;
  menuName: string;
  controlName: string;
  parentMenu: string | null;
  module: string | null; // 'Sale' | 'Purchase' | 'Inventory'
  order: number | null;
}

export interface Role {
  id: string;
  name: string;
}

/** Mirrors t_UserRole shape — flags are 'Y' | 'N' strings. */
export interface UserPermission {
  controlName: string;
  isEnable: string;
  addAccess: string;
  editAccess: string;
  deleteAccess: string;
}

export const fetchUsers = (): Promise<UserItem[]> =>
  api.get("/users?page=1&limit=100").then(unwrapPaginated<UserItem>).then((r) => r.items);

export const fetchMenus = (): Promise<Menu[]> =>
  api
    .get("/menus?page=1&limit=100")
    .then(unwrapPaginated<Menu>)
    .then((r) => r.items);

export const fetchRoles = (): Promise<Role[]> =>
  api.get("/roles?page=1&limit=100").then(unwrapPaginated<Role>).then((r) => r.items);

export const getUserPermissions = (userName: string): Promise<UserPermission[]> =>
  api.get(`/users/${userName}/permissions`).then((r) => r.data?.permissions ?? []);

/**
 * Import a role's permission set as a starting template for the user grid.
 * Role permissions are stored as booleans (isEnable/canCreate/canEdit/canDelete);
 * we map them onto the t_UserRole 'Y'/'N' shape keyed by menu controlName.
 */
export const importRoleTemplate = (roleId: string): Promise<UserPermission[]> =>
  api.get(`/permissions/role/${roleId}`).then((r) =>
    (r.data ?? []).map((p: {
      menu?: { controlName: string };
      isEnable: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
    }) => ({
      controlName: p.menu?.controlName ?? "",
      isEnable: p.isEnable ? "Y" : "N",
      addAccess: p.canCreate ? "Y" : "N",
      editAccess: p.canEdit ? "Y" : "N",
      deleteAccess: p.canDelete ? "Y" : "N",
    })),
  );

/** Sync-save: PUT replaces all t_UserRole entries for a single user in one transaction. */
export const saveUserPermissions = (userName: string, permissions: UserPermission[]) =>
  api.put(`/users/${userName}/permissions`, { roles: permissions }).then((r) => r.data);

/** Batch sync-save: apply one grid to many users in a single transaction. */
export const saveUserPermissionsBatch = (userNames: string[], permissions: UserPermission[]) =>
  api.put(`/users/permissions/batch`, { userNames, permissions }).then((r) => r.data);
