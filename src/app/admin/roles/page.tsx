"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import { Plus, Edit2 } from "lucide-react";
import { fetchRoles, createRole, updateRole, type Role } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

const emptyForm = { name: "", description: "" };

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { can } = usePermissions();
  const canAdd = can("Roles", "add");
  const canEdit = can("Roles", "edit");
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchRoles({ page, limit })
      .then(({ items, meta }) => { setRoles(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey, setMeta]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (r: Role) => { setEditing(r); setForm({ name: r.name, description: r.description ?? "" }); setModal(true); };

  const handleSave = async () => {
    if (!form.name) { toast.error("Role name is required"); return; }
    setSaving(true);
    try {
      if (editing) await updateRole(editing.id, form);
      else await createRole(form);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save")); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Roles" action={canAdd ? { label: "New Role", onClick: openCreate, icon: <Plus size={16} /> } : undefined} />
      <Table loading={loading} data={roles}
        columns={[
          { key: "name", header: "Role Name" },
          { key: "description", header: "Description" },
          { key: "actions", header: "", render: (r) => canEdit ? <button onClick={() => openEdit(r)} className="text-primary-600 hover:text-primary-800"><Edit2 size={14} /></button> : null },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
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
