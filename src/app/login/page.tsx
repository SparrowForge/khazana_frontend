"use client";
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { login, getUserBranches, type UserBranch } from "./server";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

const schema = z.object({
  userName: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  branchId: z.string().min(1, "Branch is required"),
});
type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login: storeLogin } = useAuthStore();

  const [branches, setBranches] = useState<UserBranch[]>([]);
  const [branchesReady, setBranchesReady] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { userName: "", password: "", branchId: "" },
  });

  const loadBranches = useCallback(
    async (userName: string) => {
      const trimmed = userName.trim();
      if (!trimmed) return;
      setLoadingBranches(true);
      setBranchesReady(false);
      try {
        const { branches: list } = await getUserBranches(trimmed);
        setBranches(list);
        setBranchesReady(true);
        // Auto-select when there is only one branch
        if (list.length === 1) {
          setValue("branchId", list[0].id, { shouldValidate: true });
        }
      } catch {
        setBranches([]);
        setBranchesReady(true);
      } finally {
        setLoadingBranches(false);
      }
    },
    [setValue],
  );

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await login(data);
      storeLogin(res.user as Parameters<typeof storeLogin>[0], res.accessToken);
      router.push("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Login failed");
    }
  };

  const branchPlaceholder = loadingBranches
    ? "Loading branches…"
    : branchesReady
      ? branches.length === 0
        ? "No branches assigned"
        : "— Select Branch —"
      : "Enter username first";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Khazana Mithai</h1>
          <p className="text-gray-500 text-sm mt-1">Point of Sale System</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            id="userName"
            label="Username"
            placeholder="Enter your username"
            error={errors.userName?.message}
            {...register("userName")}
            onBlur={(e) => {
              register("userName").onBlur(e);
              loadBranches(e.target.value);
            }}
          />

          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register("password")}
          />

          <Select
            id="branchId"
            label="Branch"
            placeholder={branchPlaceholder}
            error={errors.branchId?.message}
            disabled={!branchesReady || loadingBranches || branches.length === 0}
            options={branches.map((b) => ({
              value: b.id,
              label: b.branchName ?? b.branchCode ?? b.id,
            }))}
            {...register("branchId")}
          />

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign In
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
      </div>
    </div>
  );
}
