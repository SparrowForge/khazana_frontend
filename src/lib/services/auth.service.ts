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

export const authService = {
  login: (data: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", data).then((r) => r.data),
};
