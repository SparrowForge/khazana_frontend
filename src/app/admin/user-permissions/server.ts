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
  order: number | null;
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
  api.get("/users?page=1&limit=200").then(unwrapPaginated<UserItem>).then((r) => r.items);

export const fetchMenus = (): Promise<Menu[]> =>
  api
    .get("/menus?page=1&limit=200")
    .then(unwrapPaginated<Menu>)
    .then((r) => r.items);

export const getUserPermissions = (userName: string): Promise<UserPermission[]> =>
  api.get(`/users/${userName}/permissions`).then((r) => r.data?.permissions ?? []);

/** Sync-save: PUT replaces all t_UserRole entries for the user in one transaction. */
export const saveUserPermissions = (userName: string, permissions: UserPermission[]) =>
  api.put(`/users/${userName}/permissions`, { roles: permissions }).then((r) => r.data);
