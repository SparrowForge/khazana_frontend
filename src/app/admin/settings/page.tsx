"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Settings { id?: number; companyName?: string; companyAddress?: string; companyUtility?: string; reportFooter?: string; }

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/admin/settings").then((res) => setForm(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/admin/settings", form);
      toast.success("Settings saved");
    } catch { toast.error("Failed to save settings"); } finally { setSaving(false); }
  };

  if (loading) return <AppLayout><div className="text-gray-400 p-8">Loading settings...</div></AppLayout>;

  return (
    <AppLayout>
      <PageHeader title="System Settings" />
      <Card title="Company Information" className="max-w-2xl">
        <div className="space-y-4">
          <Input label="Company Name" value={form.companyName ?? ""} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          <Input label="Company Address" value={form.companyAddress ?? ""} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} />
          <Input label="Company Utility / Phone" value={form.companyUtility ?? ""} onChange={(e) => setForm({ ...form, companyUtility: e.target.value })} />
          <Input label="Report Footer" value={form.reportFooter ?? ""} onChange={(e) => setForm({ ...form, reportFooter: e.target.value })} />
          <Button onClick={handleSave} loading={saving}>Save Settings</Button>
        </div>
      </Card>
    </AppLayout>
  );
}
