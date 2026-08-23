"use client";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "./server";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import Logo from "@/components/ui/Logo";

const schema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    code: z.string().length(6, "Code must be exactly 6 digits"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/\d/, "Must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetForm = z.infer<typeof schema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const prefillEmail = searchParams.get("email") ?? "";
  const prefillCode = searchParams.get("code") ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: prefillEmail, code: prefillCode },
  });

  const onSubmit = async (data: ResetForm) => {
    try {
      const res = await resetPassword(data.email, data.code, data.newPassword);
      toast.success(res.message);
      router.push("/login");
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center"><Logo size={38} /></div>
          <p className="text-gray-500 text-sm mt-1">Reset Password</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            id="email"
            type="email"
            label="Email address"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            id="code"
            label="Reset code"
            maxLength={6}
            inputMode="numeric"
            error={errors.code?.message}
            {...register("code")}
          />
          <Input
            id="newPassword"
            type="password"
            label="New password"
            placeholder="Min 8 chars, uppercase, lowercase, number"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />
          <Input
            id="confirmPassword"
            type="password"
            label="Confirm new password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Reset Password
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          <a href="/login" className="hover:underline">Back to login</a>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-primary-900 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 text-center">
          <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
