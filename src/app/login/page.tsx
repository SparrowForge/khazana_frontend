"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { login } from "./server";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

const schema = z.object({
  userName: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login: storeLogin } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await login(data);
      storeLogin(res.user as Parameters<typeof storeLogin>[0], res.accessToken);
      router.push("/");
    } catch {
      toast.error("Invalid username or password");
    }
  };

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
          />
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register("password")}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
