"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Edit2 } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface User { id: number; name?: string; userName: string; branchId: number; isActive?: string; branch?: { branchName: string }; }
interface Branch { id: number; branchName: string; }
const emptyForm = { name: "", userName: "", password: "", branchId: "", isActive: "Y" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/users").then((res) => setUsers(res.data.data ?? res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); api.get("/admin/branches").then((res) => setBranches(res.data.data ?? res.data)).catch(() => {}); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name ?? "", userName: u.userName, password: "", branchId: String(u.branchId), isActive: u.isActive ?? "Y" });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.userName || !form.branchId) { toast.error("Username and branch are required"); return; }
    if (!editing && !form.password) { toast.error("Password is required for new users"); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: form.name, branchId: Number(form.branchId), isActive: form.isActive };
      if (!editing) { payload.userName = form.userName; payload.password = form.password; }
      if (form.password && editing) payload.password = form.password;
      if (editing) await api.patch(`/admin/users/${editing.id}`, payload);
      else await api.post("/admin/users", payload);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Users" action={{ label: "New User", onClick: openCreate, icon: <Plus size={16} /> }} />
      <Table loading={loading} data={users}
        columns={[
          { key: "userName", header: "Username" },
          { key: "name", header: "Name" },
          { key: "branch", header: "Branch", render: (r) => r.branch?.branchName ?? r.branchId },
          { key: "isActive", header: "Active" },
          { key: "actions", header: "", render: (r) => <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button> },
        ]}
      />
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit User" : "New User"}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Username *" value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} disabled={!!editing} />
          <Input label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={editing ? "New Password (leave blank to keep)" : "Password *"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select label="Branch *" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            placeholder="Select branch..." options={branches.map((b) => ({ value: b.id, label: b.branchName }))} />
          <Select label="Active" value={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.value })} options={[{ value: "Y", label: "Yes" }, { value: "N", label: "No" }]} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
