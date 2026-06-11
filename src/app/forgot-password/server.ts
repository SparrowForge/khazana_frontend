import api from "@/lib/api";

export const forgotPassword = (email: string) =>
  api.post<{ message: string }>("/auth/forgot-password", { email }).then((r) => r.data);
