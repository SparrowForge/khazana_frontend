"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Plus, Edit2 } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Role { id: number; name: string; description?: string; }
const emptyForm = { name: "", description: "" };

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/roles").then((res) => setRoles(res.data.data ?? res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (r: Role) => { setEditing(r); setForm({ name: r.name, description: r.description ?? "" }); setModal(true); };

  const handleSave = async () => {
    if (!form.name) { toast.error("Role name is required"); return; }
    setSaving(true);
    try {
      if (editing) await api.patch(`/admin/roles/${editing.id}`, form);
      else await api.post("/admin/roles", form);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Roles" action={{ label: "New Role", onClick: openCreate, icon: <Plus size={16} /> }} />
      <Table loading={loading} data={roles}
        columns={[
          { key: "name", header: "Role Name" },
          { key: "description", header: "Description" },
          { key: "actions", header: "", render: (r) => <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button> },
        ]}
      />
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Role" : "New Role"}>
        <div className="space-y-4">
          <Input label="Role Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
