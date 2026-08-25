"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyEmail, resendVerification } from "./server";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Logo from "@/components/ui/Logo";

const resendSchema = z.object({ email: z.string().email("Enter a valid email") });
type ResendForm = z.infer<typeof resendSchema>;
type Status = "loading" | "success" | "error" | "idle";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>(token ? "loading" : "idle");
  const [message, setMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResendForm>({ resolver: zodResolver(resendSchema) });

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then((res) => { setStatus("success"); setMessage(res.message); })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message ?? "Invalid or expired verification link.");
      });
  }, [token]);

  const onResend = async (data: ResendForm) => {
    try {
      const res = await resendVerification(data.email);
      toast.success(res.message);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center"><Logo size={38} /></div>
          <p className="text-gray-500 text-sm mt-1">Email Verification</p>
        </div>

        {status === "loading" && (
          <div className="text-center py-6">
            <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-gray-500 text-sm">Verifying your email…</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium">{message}</p>
            <Button className="w-full" onClick={() => router.push("/login")}>Go to Login</Button>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium">{message}</p>
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <div className="mt-6 border-t pt-6">
            <p className="text-sm text-gray-500 mb-4 text-center">
              Didn&apos;t receive the email? Resend it below.
            </p>
            <form onSubmit={handleSubmit(onResend)} className="space-y-4">
              <Input
                id="email"
                type="email"
                label="Email address"
                placeholder="your@email.com"
                error={errors.email?.message}
                {...register("email")}
              />
              <Button type="submit" className="w-full" loading={isSubmitting}>
                Resend Verification Email
              </Button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          <a href="/login" className="hover:underline">Back to login</a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-900 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 text-center">
          <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
