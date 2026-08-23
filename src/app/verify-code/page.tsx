"use client";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyResetCode } from "./server";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import Logo from "@/components/ui/Logo";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  code: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d+$/, "Code must contain only digits"),
});
type CodeForm = z.infer<typeof schema>;

function VerifyCodeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefillEmail = searchParams.get("email") ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: prefillEmail },
  });

  const onSubmit = async (data: CodeForm) => {
    try {
      const res = await verifyResetCode(data.email, data.code);
      toast.success(res.message);
      router.push(
        `/reset-password?email=${encodeURIComponent(data.email)}&code=${encodeURIComponent(data.code)}`,
      );
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Invalid or expired code. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center"><Logo size={38} /></div>
          <p className="text-gray-500 text-sm mt-1">Enter Reset Code</p>
        </div>

        <p className="text-sm text-gray-500 mb-6 text-center">
          Enter the 6-digit code we sent to your email. It expires in{" "}
          <strong>10 minutes</strong>.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            id="email"
            type="email"
            label="Email address"
            placeholder="your@email.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            id="code"
            label="6-digit code"
            placeholder="123456"
            maxLength={6}
            inputMode="numeric"
            error={errors.code?.message}
            {...register("code")}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Verify Code
          </Button>
        </form>

        <div className="mt-5 text-center space-y-1">
          <a href="/forgot-password" className="text-xs text-gray-400 hover:underline block">
            Didn&apos;t receive a code? Request again
          </a>
          <a href="/login" className="text-xs text-gray-400 hover:underline block">
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}

export default function VerifyCodePage() {
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
      <VerifyCodeContent />
    </Suspense>
  );
}
