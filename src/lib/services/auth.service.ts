import api from "@/lib/api";
import { User } from "@/types";

export interface LoginPayload {
  userName: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  access_token: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/** Safe profile returned by GET /auth/profile — password/token fields are stripped server-side. */
export interface ProfileResponse extends User {
  email?: string | null;
  contactNo?: string | null;
  userRoles?: { roleId: string }[];
  branchMappings?: { branch?: { branchName?: string | null; branchCode?: string | null } | null }[];
}

export const authService = {
  login: (data: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", data).then((r) => r.data),

  getProfile: () =>
    api.get<ProfileResponse>("/auth/profile").then((r) => r.data),

  changePassword: (data: ChangePasswordPayload) =>
    api.patch<{ message: string }>("/auth/change-password", data).then((r) => r.data),
};
