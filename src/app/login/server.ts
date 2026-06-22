import api from "@/lib/api";

export interface UserBranch {
  id: string;
  branchCode: string | null;
  branchName: string | null;
}

export const getUserBranches = (userName: string): Promise<{ branches: UserBranch[] }> =>
  api
    .get(`/auth/user-branches?userName=${encodeURIComponent(userName)}`)
    .then((r) => r.data);

export const login = (data: { branchId: string; userName: string; password: string }) =>
  api.post<{ user: unknown; accessToken: string }>("/auth/login", data).then((r) => r.data);
