import api from "@/lib/api";
import { unwrapPaginated } from "@/lib/unwrap";

export interface UserItem {
  id: string;
  userName: string;
  name: string | null;
  isActive: string | null;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

/** t_UserRole shape — flags are 'Y' | 'N' strings, keyed by menu controlName. */
export interface UserRolePerm {
  controlName: string;
  isEnable: string;
  addAccess: string;
  editAccess: string;
  deleteAccess: string;
}

interface RolePermRow {
  menu?: { controlName: string };
  isEnable: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export const fetchUsers = (): Promise<UserItem[]> =>
  api.get("/users?page=1&limit=200").then(unwrapPaginated<UserItem>).then((r) => r.items);

export const fetchRoles = (): Promise<Role[]> =>
  api.get("/roles?page=1&limit=100").then(unwrapPaginated<Role>).then((r) => r.items);

/**
 * There is no user↔Role join table — a user's access lives in t_UserRole (per-menu
 * Y/N flags). "Assigning roles" therefore means materialising the UNION of the
 * selected roles' menu permissions into the user's grid. Each role's permissions
 * come from the role-RBAC tables as booleans; OR them together per menu controlName.
 */
export const buildPermissionsFromRoles = async (roleIds: string[]): Promise<UserRolePerm[]> => {
  const perRole = await Promise.all(
    roleIds.map((id) => api.get(`/permissions/role/${id}`).then((r) => (r.data ?? []) as RolePermRow[])),
  );
  const merged = new Map<string, UserRolePerm>();
  for (const rows of perRole) {
    for (const p of rows) {
      const cn = p.menu?.controlName;
      if (!cn) continue;
      const cur = merged.get(cn) ?? { controlName: cn, isEnable: "N", addAccess: "N", editAccess: "N", deleteAccess: "N" };
      merged.set(cn, {
        controlName: cn,
        isEnable: p.isEnable || cur.isEnable === "Y" ? "Y" : "N",
        addAccess: p.canCreate || cur.addAccess === "Y" ? "Y" : "N",
        editAccess: p.canEdit || cur.editAccess === "Y" ? "Y" : "N",
        deleteAccess: p.canDelete || cur.deleteAccess === "Y" ? "Y" : "N",
      });
    }
  }
  return Array.from(merged.values());
};

/** Apply one permission grid to many users atomically (delete-then-insert per user). */
export const assignRolesToUsers = (userNames: string[], permissions: UserRolePerm[]) =>
  api.put("/users/permissions/batch", { userNames, permissions }).then((r) => r.data);
