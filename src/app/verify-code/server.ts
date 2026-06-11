import api from "@/lib/api";

export const verifyResetCode = (email: string, code: string) =>
  api.post<{ message: string }>("/auth/verify-reset-code", { email, code }).then((r) => r.data);
