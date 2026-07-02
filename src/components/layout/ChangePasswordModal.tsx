"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authService } from "@/lib/services/auth.service";

// Password strength rules match the reset-password flow (stricter than the
// backend ChangePasswordDto's min-6, which stays valid as a stricter subset).
const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/\d/, "Must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type ChangePasswordForm = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: ChangePasswordForm) => {
    setSubmitting(true);
    try {
      await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Password changed successfully");
      close();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Change Password" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="currentPassword"
          type="password"
          label="Current Password"
          placeholder="Enter current password"
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />
        <Input
          id="newPassword"
          type="password"
          label="New Password"
          placeholder="Min 8 chars, upper, lower & number"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <Input
          id="confirmPassword"
          type="password"
          label="Confirm New Password"
          placeholder="Re-enter new password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Update Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
