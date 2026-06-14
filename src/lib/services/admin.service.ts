import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface AdminUser {
  id: number;
  name?: string;
  userName: string;
  branchId: number;
  isActive?: string;
  branch?: { branchName: string };
}

export interface AdminUserPayload {
  name?: string;
  userName?: string;
  password?: string;
  branchId: number;
  isActive?: string;
}

export interface Branch {
  id: number;
  branchCode: string;
  branchName: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
}

export interface BranchPayload {
  branchCode: string;
  branchName: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface RolePayload {
  name: string;
  description?: string;
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

export interface Settings {
  id?: number;
  companyName?: string;
  companyAddress?: string;
  companyUtility?: string;
  reportFooter?: string;
}

export interface AuditLog {
  id: number;
  userId?: number;
  action?: string;
  entity?: string;
  entityId?: string;
  createdAt?: string;
  user?: { userName: string };
}


export const adminService = {
  listUsers: () =>
    api.get<{ data: AdminUser[] } | AdminUser[]>("/admin/users").then(unwrapList<AdminUser>),

  createUser: (data: AdminUserPayload) =>
    api.post<AdminUser>("/admin/users", data).then((r) => r.data),

  updateUser: (id: number, data: Partial<AdminUserPayload>) =>
    api.patch<AdminUser>(`/admin/users/${id}`, data).then((r) => r.data),

  listBranches: () =>
    api.get<{ data: Branch[] } | Branch[]>("/admin/branches").then(unwrapList<Branch>),

  createBranch: (data: BranchPayload) =>
    api.post<Branch>("/admin/branches", data).then((r) => r.data),

  updateBranch: (id: number, data: Partial<BranchPayload>) =>
    api.patch<Branch>(`/admin/branches/${id}`, data).then((r) => r.data),

  listRoles: () =>
    api.get<{ data: Role[] } | Role[]>("/admin/roles").then(unwrapList<Role>),

  createRole: (data: RolePayload) =>
    api.post<Role>("/admin/roles", data).then((r) => r.data),

  updateRole: (id: number, data: Partial<RolePayload>) =>
    api.patch<Role>(`/admin/roles/${id}`, data).then((r) => r.data),

  listMenus: () =>
    api.get<{ data: Menu[] } | Menu[]>("/admin/menus").then(unwrapList<Menu>),

  getPermissions: (roleId: number | string) =>
    api.get<{ data: Permission[] } | Permission[]>(`/admin/permissions?roleId=${roleId}`).then(unwrapList<Permission>),

  savePermissions: (roleId: number | string, permissions: Omit<Permission, "menuId"> & { menuId: number }[]) =>
    api.post(`/admin/permissions/${roleId}`, permissions).then((r) => r.data),

  getSettings: () =>
    api.get<Settings>("/admin/settings").then((r) => r.data),

  updateSettings: (data: Partial<Settings>) =>
    api.patch<Settings>("/admin/settings", data).then((r) => r.data),

  listAuditLog: () =>
    api.get<{ data: AuditLog[] } | AuditLog[]>("/admin/audit-log").then(unwrapList<AuditLog>),
};
