import api from "@/lib/api";

export const login = (data: { userName: string; password: string }) =>
  api.post<{ user: unknown; accessToken: string }>("/auth/login", data).then((r) => r.data);
