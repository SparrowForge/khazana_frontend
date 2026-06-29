import { useAuthStore } from "@/store/auth.store";
import type { UserPermission } from "@/types";

export type PermissionAction = "view" | "add" | "edit" | "delete";

/**
 * Reads the logged-in user's permission grid (t_UserRole, surfaced as
 * `user.permissions`) and answers `can(controlName, action)`.
 *
 * A permission requires the menu to be enabled (`isEnable === 'Y'`) plus the
 * matching access flag. Mirrors the backend MenuAccessGuard so the UI hides what
 * the API would reject.
 */
export function usePermissions() {
  const permissions = useAuthStore((s) => s.user?.permissions) ?? [];

  const can = (controlName: string, action: PermissionAction = "view"): boolean => {
    const perm: UserPermission | undefined = permissions.find((p) => p.controlName === controlName);
    if (!perm || perm.isEnable !== "Y") return false;
    switch (action) {
      case "add": return perm.addAccess === "Y";
      case "edit": return perm.editAccess === "Y";
      case "delete": return perm.deleteAccess === "Y";
      default: return true; // view — menu is enabled
    }
  };

  return { can };
}
