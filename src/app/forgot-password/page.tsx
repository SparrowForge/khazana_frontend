"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { forgotPassword } from "./server";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import Logo from "@/components/ui/Logo";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: ForgotForm) => {
    try {
      const res = await forgotPassword(data.email);
      toast.success(res.message);
      // Pass email to next step via URL param (not sensitive — just an address)
      router.push(`/verify-code?email=${encodeURIComponent(data.email)}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center"><Logo size={38} /></div>
          <p className="text-gray-500 text-sm mt-1">Forgot Password</p>
        </div>

        <p className="text-sm text-gray-500 mb-6 text-center">
          Enter your registered email address and we&apos;ll send you a 6-digit reset code.
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
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Send Reset Code
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          <a href="/login" className="hover:underline">Back to login</a>
        </p>
      </div>
    </div>
  );
}
