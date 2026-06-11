import api from "@/lib/api";

export const resetPassword = (email: string, code: string, newPassword: string) =>
  api
    .post<{ message: string }>("/auth/reset-password", { email, code, newPassword })
    .then((r) => r.data);
