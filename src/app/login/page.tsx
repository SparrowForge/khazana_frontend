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
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/api";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

const schema = z.object({
  userName: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  branchId: z.string().min(1, "Branch is required"),
});
type LoginForm = z.infer<typeof schema>;

const DEBOUNCE_MS = 600;

/** The modules ringed around the mark on the brand panel. Purely decorative —
 *  they describe the product, not the user's permissions. */
const MODULES = [
  "Point of Sale", "Production", "Inventory", "Stock Transfer",
  "Demand Orders", "Credit Sales", "Customers", "Pricing",
  "Assortment", "Packets", "Reports", "Accounts",
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
      ? "Loading branches…"
      : branches.length === 0
        ? "No branches assigned"
        : "— Select Branch —";

  const fieldClass =
    "w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm shadow-sm " +
    "transition-colors focus:border-primary-800 focus:outline-none focus:ring-1 focus:ring-primary-800";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Brand panel. Hidden below lg: on a phone it would push the form
             off-screen, and the form is the point of the page. ── */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-900 via-slate-900 to-primary-800 p-10 text-white">
        {/* Soft radial glow behind the mark */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 45%, rgba(56,189,248,0.35) 0%, rgba(2,6,23,0) 70%)",
          }}
        />

        <div className="relative">
          <Logo size={40} tone="light" />
          <div className="mt-2 text-[11px] uppercase tracking-[0.25em] text-sky-200/80">
            Point of Sale 
          </div>
        </div>

        {/* The module ring: a circle of labels around a central mark. Laid out
            with trigonometry so it stays even at any count. */}
        <div className="relative mx-auto my-8 aspect-square w-full max-w-[430px]">
          <div className="absolute inset-[18%] rounded-full border border-sky-300/30" />
          <div className="absolute inset-[6%] rounded-full border border-sky-300/20" />
          <div className="absolute inset-[27%] rounded-full bg-white/95 shadow-2xl shadow-sky-500/20" />
          <div className="absolute inset-[27%] flex flex-col items-center justify-center text-primary-900">
            <span class="text-3xl font-extrabold tracking-wider">KHAZANA</span>            
            <span className="mt-2 text-[18px] font-semibold uppercase tracking-[0.2em] text-primary-700">
              MITHAI
            </span>
            
          </div>
          {MODULES.map((label, i) => {
            const angle = (i / MODULES.length) * 2 * Math.PI - Math.PI / 2;
            const radius = 44; // % from centre
            return (
              <div
                key={label}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${50 + radius * Math.cos(angle)}%`,
                  top: `${50 + radius * Math.sin(angle)}%`,
                }}
              >
                <span className="whitespace-nowrap rounded-md bg-white/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-sky-50 ring-1 ring-white/15 backdrop-blur-sm">
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="relative flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
          <ShieldCheck className="mt-0.5 shrink-0 text-sky-200" size={22} />
          <div>
            <div className="text-sm font-semibold">Secure. Reliable. Intelligent.</div>
            <p className="mt-1 text-xs leading-relaxed text-sky-100/80">
              Branch-aware access control, audited every step — built for speed, accuracy and
              complete control.
            </p>
          </div>
        </div>
      </div>

      {/* ── Sign-in panel ── */}
      <div className="flex flex-col justify-between bg-white px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <div className="lg:hidden mb-8 flex flex-col items-center gap-1.5">
            <Logo size={38} />
            <div className="text-xs text-gray-500">Point of Sale</div>
          </div>

          <div className="mb-8 hidden lg:flex items-center gap-4">
            <Logo size={38} />            
          </div>

          <h1 className="text-3xl font-bold text-gray-900">Welcome back!</h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in to continue to your Khazana workspace.
          </p>

          {/* Google-only step: the credential is in hand but the account spans
              several branches, so the password form is replaced by the picker. */}
          {googleCredential ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Signed in with Google. Choose the branch to continue.
              </div>
              <Select
                label="Branch"
                value={googleBranchId}
                onChange={(e) => setGoogleBranchId(e.target.value)}
                placeholder="— Select Branch —"
                options={googleBranchList.map((b) => ({
                  value: b.id,
                  label: b.branchName ?? b.branchCode ?? b.id,
                }))}
              />
              <Button
                className="w-full"
                loading={googleBusy}
                disabled={!googleBranchId}
                onClick={completeGoogleLogin}
              >
                Continue <ArrowRight size={16} />
              </Button>
              <button
                type="button"
                onClick={() => setGoogleCredential(null)}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700 hover:underline"
              >
                Use a different account
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="userName" className="mb-1.5 block text-sm font-medium text-gray-700">
                    User Name
                  </label>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="userName"
                      autoComplete="username"
                      placeholder="Enter Your User Name"
                      className={fieldClass}
                      {...register("userName")}
                      onChange={handleUserNameChange}
                      onBlur={handleUserNameBlur}
                    />
                  </div>
                  {errors.userName && (
                    <p className="mt-1 text-xs text-red-500">{errors.userName.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter Your Password"
                      className={fieldClass}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                  )}
                </div>

                {/* Revealed only once the username lookup has been triggered */}
                {branchLoadState !== "idle" && (
                  <Select
                    id="branchId"
                    label="Branch"
                    placeholder={branchPlaceholder}
                    error={errors.branchId?.message}
                    disabled={branchLoadState === "loading" || branches.length === 0}
                    options={branches.map((b) => ({
                      value: b.id,
                      label: b.branchName ?? b.branchCode ?? b.id,
                    }))}
                    {...register("branchId")}
                  />
                )}

                <Button
                  type="submit"
                  className="w-full py-2.5"
                  loading={isSubmitting}
                  disabled={!canSubmit}
                >
                  <LogIn size={16} /> Sign In <ArrowRight size={16} />
                </Button>

                <div className="text-center">
                  <a
                    href="/forgot-password"
                    className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
              </form>

              {/* Only drawn when Google is actually configured — otherwise the
                  divider would sit above nothing. */}
              {GOOGLE_CLIENT_ID && (
                <div className="mt-7">
                  <div className="relative mb-5 text-center">
                    <span className="absolute inset-x-0 top-1/2 border-t border-gray-200" />
                    <span className="relative bg-white px-3 text-xs uppercase tracking-wider text-gray-400">
                      Or continue with
                    </span>
                  </div>
                  <GoogleSignInButton onCredential={handleGoogleCredential} disabled={googleBusy} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-2 text-[11px] text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            Your data is protected with enterprise-grade security
          </span>
          <span>© {new Date().getFullYear()} Khazana Mithai</span>
        </div>
      </div>
    </div>
  );
}
