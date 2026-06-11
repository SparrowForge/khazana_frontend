import api from "@/lib/api";

export const verifyEmail = (token: string) =>
  api.post<{ message: string }>("/auth/verify-email", { token }).then((r) => r.data);

export const resendVerification = (email: string) =>
  api.post<{ message: string }>("/auth/resend-verification-email", { email }).then((r) => r.data);
