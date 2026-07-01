"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { fetchCategories, createCategory, updateCategory, deleteCategory, type Category } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ code: "", name: "", remarks: "" });
  const [saving, setSaving] = useState(false);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();
  const { can } = usePermissions();
  const canAdd = can("Categories", "add");
  const canEdit = can("Categories", "edit");
  const canDelete = can("Categories", "delete");

  const load = () => {
    setLoading(true);
    fetchCategories({ page, limit })
      .then(({ items, meta }) => { setCategories(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey, setMeta]);

  const openCreate = () => { setEditing(null); setForm({ code: "", name: "", remarks: "" }); setModal(true); };
  const openEdit = (c: Category) => { setEditing(c); setForm({ code: c.code, name: c.name ?? "", remarks: c.remarks ?? "" }); setModal(true); };

  const handleSave = async () => {
    if (!form.code) { toast.error("Code is required"); return; }
    setSaving(true);
    try {
      if (editing) await updateCategory(editing.id, form);
      else await createCategory(form);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  const handleDelete = async (c: Category) => {
    if (!confirm(`Delete "${c.code}"?`)) return;
    try { await deleteCategory(c.id); toast.success("Deleted"); load(); }
    catch { toast.error("Failed to delete"); }
  };

  return (
    <AppLayout>
      <PageHeader title="Item Categories" action={canAdd ? { label: "New Category", onClick: openCreate, icon: <Plus size={16} /> } : undefined} />
      <Table loading={loading} data={categories}
        columns={[
          { key: "code", header: "Code" },
          { key: "name", header: "Name" },
          { key: "remarks", header: "Remarks" },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-2">
              {canEdit && <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>}
              {canDelete && <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
            </div>
          )},
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Category" : "New Category"}>
        <div className="space-y-4">
          <Input label="Code *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editing} />
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
