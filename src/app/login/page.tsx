"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import {
  login,
  getUserBranches,
  googleBranches,
  googleLogin,
  GOOGLE_CLIENT_ID,
  type UserBranch,
} from "./server";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/api";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  Store,
  User as UserIcon,
} from "lucide-react";

const schema = z.object({
  userName: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  branchId: z.string().min(1, "Branch is required"),
});
type LoginForm = z.infer<typeof schema>;

const DEBOUNCE_MS = 600;

/** What the brand panel says the product does. Three claims, not twelve — a
 *  wall of module names reads as a brochure, not as a sign-in screen. */
const HIGHLIGHTS = [
  {
    icon: Store,
    title: "Counter to factory, one system",
    body: "Point of sale, production, stock movement and demand orders share a single ledger.",
  },
  {
    icon: BarChart3,
    title: "Numbers you can close the day on",
    body: "Sales, VAT and stock positions reconcile per branch, per shift, as they happen.",
  },
  {
    icon: ShieldCheck,
    title: "Access scoped to the branch",
    body: "Everyone sees only the branches they are assigned, and every entry is attributed.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login: storeLogin, isAuthenticated } = useAuthStore();

  // Already signed in (valid persisted token) → bounce to the dashboard.
  // Wait for hydration so the persisted zustand state is read before deciding.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace("/");
    }
  }, [hydrated, isAuthenticated, router]);

  const [branches, setBranches] = useState<UserBranch[]>([]);
  // "idle"    → username not yet checked — branch dropdown is hidden
  // "loading" → API in flight — dropdown visible with loading placeholder
  // "done"    → API returned — dropdown visible with options (or empty notice)
  const [branchLoadState, setBranchLoadState] = useState<"idle" | "loading" | "done">("idle");
  const [showPassword, setShowPassword] = useState(false);

  // ── Google sign-in state ──
  // A Google account mapped to several branches can't be signed in blind, so the
  // credential is parked here while the user picks one.
  const [googleCredential, setGoogleCredential] = useState<string | null>(null);
  const [googleBranchList, setGoogleBranchList] = useState<UserBranch[]>([]);
  const [googleBranchId, setGoogleBranchId] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { userName: "", password: "", branchId: "" },
  });

  // Derive canSubmit from live field values — all three must be non-empty
  const [watchedUserName, watchedPassword, watchedBranchId] = watch([
    "userName",
    "password",
    "branchId",
  ]);
  const canSubmit =
    watchedUserName.trim().length > 0 &&
    watchedPassword.length > 0 &&
    watchedBranchId.length > 0;

  const loadBranches = useCallback(
    async (userName: string) => {
      const trimmed = userName.trim();
      if (!trimmed) {
        // Username cleared — hide dropdown and reset selection
        setBranches([]);
        setBranchLoadState("idle");
        setValue("branchId", "");
        return;
      }
      setBranchLoadState("loading");
      setValue("branchId", "");
      try {
        const { branches: list } = await getUserBranches(trimmed);
        setBranches(list);
        setBranchLoadState("done");
        // Auto-select when the user belongs to exactly one branch
        if (list.length === 1) {
          setValue("branchId", list[0].id, { shouldValidate: true });
        }
      } catch {
        setBranches([]);
        setBranchLoadState("done");
      }
    },
    [setValue],
  );

  // Debounced onChange — fires 600 ms after the user stops typing
  const handleUserNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      register("userName").onChange(e);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        loadBranches(e.target.value);
      }, DEBOUNCE_MS);
    },
    [register, loadBranches],
  );

  // onBlur — cancel the pending debounce and fire immediately
  const handleUserNameBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      register("userName").onBlur(e);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      loadBranches(e.target.value);
    },
    [register, loadBranches],
  );

  const finish = (res: { user: unknown; accessToken: string }) => {
    storeLogin(res.user as Parameters<typeof storeLogin>[0], res.accessToken);
    router.push("/");
  };

  const onSubmit = async (data: LoginForm) => {
    try {
      finish(await login(data));
    } catch (err) {
      toast.error(getErrorMessage(err, "Login failed"));
    }
  };

  /** Google handed us an ID token. One branch → straight in; several → ask. */
  const handleGoogleCredential = useCallback(async (credential: string) => {
    setGoogleBusy(true);
    try {
      const identity = await googleBranches(credential);
      if (identity.branches.length === 1) {
        finish(await googleLogin(credential, identity.branches[0].id));
        return;
      }
      if (identity.branches.length === 0) {
        toast.error("No branch is assigned to this account");
        return;
      }
      setGoogleCredential(credential);
      setGoogleBranchList(identity.branches);
      setGoogleBranchId("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Google sign-in failed"));
    } finally {
      setGoogleBusy(false);
    }
    // finish() only uses stable refs from the store/router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeGoogleLogin = async () => {
    if (!googleCredential || !googleBranchId) return;
    setGoogleBusy(true);
    try {
      finish(await googleLogin(googleCredential, googleBranchId));
    } catch (err) {
      toast.error(getErrorMessage(err, "Google sign-in failed"));
    } finally {
      setGoogleBusy(false);
    }
  };

  // Don't flash the form before hydration settles or while redirecting an
  // already-authenticated user to the dashboard.
  if (!hydrated || isAuthenticated) return null;

  const branchPlaceholder =
    branchLoadState === "loading"
      ? "Checking your branches…"
      : branches.length === 0
        ? "No branch assigned to this user"
        : "Select a branch";

  const branchOptions = (googleCredential ? googleBranchList : branches).map((b) => ({
    value: b.id,
    label: b.branchName ?? b.branchCode ?? b.id,
  }));

  // One field style for every control on the page. The branch picker used to
  // borrow the generic <Select>, which sits at a different height and radius
  // from the inputs — three controls that don't line up is the quickest way to
  // look unfinished.
  const field = (invalid?: boolean) =>
    [
      "h-12 w-full rounded-xl border bg-slate-50/70 pl-11 pr-11 text-sm text-slate-900",
      "placeholder:text-slate-400 shadow-sm transition duration-150",
      "focus:bg-white focus:outline-none focus:ring-4",
      invalid
        ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
        : "border-slate-200 hover:border-slate-300 focus:border-primary-600 focus:ring-primary-600/10",
    ].join(" ");

  const iconClass = "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400";
  const labelClass = "block text-[13px] font-medium text-slate-700";

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      {/* ── Brand panel. Hidden below lg: on a phone it would push the form
             off-screen, and the form is the point of the page. ── */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-slate-950 px-12 py-12 text-white xl:px-16">
        {/* Depth in two quiet layers: a navy wash, and a hairline grid faded
            out towards the edges so the corners never read as flat black. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 0%, #1e3a8a 0%, #101a33 45%, #060a14 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(80% 70% at 30% 25%, #000 0%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(80% 70% at 30% 25%, #000 0%, transparent 100%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <Logo size={38} tone="light" />
          <span className="h-6 w-px bg-white/20" />
          <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300">
            Point of Sale
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[2.05rem] font-semibold leading-[1.2] tracking-tight">
            Every branch, every batch,
            <br />
            <span className="text-sky-300">accounted for.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300/90">
            The operations platform behind Khazana Mithai — from the counter and the production
            floor through to the closing report.
          </p>

          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] ring-1 ring-inset ring-white/10">
                  <Icon size={18} className="text-sky-300" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-slate-500">
          <span>© {new Date().getFullYear()} Khazana Mithai. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-400/80" />
            Encrypted connection
          </span>
        </div>
      </aside>

      {/* ── Sign-in panel ── */}
      <main className="flex min-h-screen flex-col justify-between px-6 py-10 sm:px-12 lg:px-14 xl:px-20">
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center">
          <div className="mb-9 flex flex-col items-center gap-2 lg:hidden">
            <Logo size={40} />
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
              Point of Sale
            </div>
          </div>

          <div>
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-slate-900">Sign in</h1>
            <p className="mt-2 text-sm text-slate-500">
              Use your Khazana account to continue to the workspace.
            </p>
          </div>

          {/* Google-only step: the credential is in hand but the account spans
              several branches, so the password form is replaced by the picker. */}
          {googleCredential ? (
            <div className="mt-8 space-y-5">
              <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-[13px] leading-relaxed text-sky-900">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-sky-600" />
                <span>Verified with Google. Choose the branch you are signing in to.</span>
              </div>

              <div>
                <label htmlFor="googleBranch" className={`mb-2 ${labelClass}`}>
                  Branch
                </label>
                <div className="relative">
                  <Building2 className={iconClass} size={17} />
                  <select
                    id="googleBranch"
                    value={googleBranchId}
                    onChange={(e) => setGoogleBranchId(e.target.value)}
                    className={`${field()} appearance-none`}
                  >
                    <option value="">Select a branch</option>
                    {branchOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={17}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <Button
                className="h-12 w-full rounded-xl text-sm shadow-sm shadow-primary-900/10"
                loading={googleBusy}
                disabled={!googleBranchId}
                onClick={completeGoogleLogin}
              >
                Continue <ArrowRight size={16} />
              </Button>
              <button
                type="button"
                onClick={() => setGoogleCredential(null)}
                className="w-full text-center text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800"
              >
                Use a different account
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="userName" className={`mb-2 ${labelClass}`}>
                    Username
                  </label>
                  <div className="relative">
                    <UserIcon className={iconClass} size={17} />
                    <input
                      id="userName"
                      autoComplete="username"
                      placeholder="Enter your username"
                      className={field(!!errors.userName)}
                      {...register("userName")}
                      onChange={handleUserNameChange}
                      onBlur={handleUserNameBlur}
                    />
                    {/* The branch lookup is driven by this field, so its progress
                        belongs here and not only on the dropdown below. */}
                    {branchLoadState === "loading" && (
                      <Loader2
                        size={16}
                        className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                      />
                    )}
                  </div>
                  {errors.userName && (
                    <p className="mt-1.5 text-xs text-red-600">{errors.userName.message}</p>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <label htmlFor="password" className={labelClass}>
                      Password
                    </label>
                    <a
                      href="/forgot-password"
                      className="text-[12px] font-medium text-primary-700 transition-colors hover:text-primary-800 hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className={iconClass} size={17} />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className={field(!!errors.password)}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
                  )}
                </div>

                {/* Revealed only once the username lookup has been triggered */}
                {branchLoadState !== "idle" && (
                  <div>
                    <label htmlFor="branchId" className={`mb-2 ${labelClass}`}>
                      Branch
                    </label>
                    <div className="relative">
                      <Building2 className={iconClass} size={17} />
                      <select
                        id="branchId"
                        disabled={branchLoadState === "loading" || branches.length === 0}
                        className={`${field(!!errors.branchId)} appearance-none disabled:cursor-not-allowed disabled:text-slate-400`}
                        {...register("branchId")}
                      >
                        <option value="">{branchPlaceholder}</option>
                        {branchOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={17}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                    </div>
                    {errors.branchId && (
                      <p className="mt-1.5 text-xs text-red-600">{errors.branchId.message}</p>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl text-sm shadow-sm shadow-primary-900/10"
                  loading={isSubmitting}
                  disabled={!canSubmit}
                >
                  Sign in <ArrowRight size={16} />
                </Button>
              </form>

              {/* Only drawn when Google is actually configured — otherwise the
                  divider would sit above nothing. */}
              {GOOGLE_CLIENT_ID && (
                <div className="mt-7">
                  <div className="relative mb-5 text-center">
                    <span className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
                    <span className="relative bg-white px-3 text-[11px] font-medium uppercase tracking-[0.15em] text-slate-400">
                      or
                    </span>
                  </div>
                  <GoogleSignInButton onCredential={handleGoogleCredential} disabled={googleBusy} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="mx-auto mt-10 w-full max-w-[380px] text-center text-[11px] leading-relaxed text-slate-400">
          <span className="lg:hidden">© {new Date().getFullYear()} Khazana Mithai · </span>
          Trouble signing in? Contact your branch administrator.
        </div>
      </main>
    </div>
  );
}
