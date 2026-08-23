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

// ── Google Sign-In ────────────────────────────────────────────────────
//
// `credential` is the ID token Google Identity Services hands the browser. It is
// only ever passed through — the server verifies its signature and audience, so
// nothing here decides who the user is.

export interface GoogleIdentity {
  email: string | null;
  name: string | null;
  branches: UserBranch[];
}

/** Step 1: who this Google account maps to, and where they may sign in. */
export const googleBranches = (credential: string): Promise<GoogleIdentity> =>
  api.post("/auth/google/branches", { credential }).then((r) => r.data);

/** Step 2: exchange the Google credential for a session. `branchId` may be
 *  omitted when the account is mapped to exactly one branch. */
export const googleLogin = (credential: string, branchId?: string) =>
  api
    .post<{ user: unknown; accessToken: string }>("/auth/google", { credential, branchId })
    .then((r) => r.data);

/** Empty when Google sign-in isn't configured for this deployment — the button
 *  is hidden rather than rendered broken. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
