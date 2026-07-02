"use client";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ChangePasswordModal from "@/components/layout/ChangePasswordModal";
import { authService, type ProfileResponse } from "@/lib/services/auth.service";
import { useAuthStore } from "@/store/auth.store";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-800">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    authService
      .getProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  // Fall back to the session user while the profile request is in flight.
  const p = profile ?? (user as ProfileResponse | null);
  const branchName =
    p?.branchMappings?.[0]?.branch?.branchName ?? user?.branchName ?? null;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="My Profile"
        subtitle="Your account information"
        action={{
          label: "Change Password",
          onClick: () => setPwOpen(true),
          icon: <KeyRound size={16} />,
        }}
      />

      <Card>
        {loading && !p ? (
          <p className="text-sm text-gray-500">Loading profile…</p>
        ) : (
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Name" value={p?.name} />
            <Field label="Username" value={p?.userName} />
            <Field label="Email" value={p?.email} />
            <Field label="Contact No" value={p?.contactNo} />
            <Field label="Branch" value={branchName} />
            <Field label="Status" value={p?.isActive === "Y" ? "Active" : p?.isActive ?? "—"} />
          </dl>
        )}
      </Card>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
