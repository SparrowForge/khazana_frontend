"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Edit2, Trash2 } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Item {
  id: number;
  itmCode: string;
  itmName?: string;
  itmCategory?: string;
  itmType?: string;
  itmUOM?: string;
  isActive?: string;
}

const emptyItem = { itmCode: "", itmName: "", itmCategory: "", itmType: "", itmUOM: "", isActive: "Y" };

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/items?limit=500").then((res) => setItems(res.data.data ?? res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(emptyItem); setModal(true); };
  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({ itmCode: item.itmCode, itmName: item.itmName ?? "", itmCategory: item.itmCategory ?? "", itmType: item.itmType ?? "", itmUOM: item.itmUOM ?? "", isActive: item.isActive ?? "Y" });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.itmCode) { toast.error("Item code is required"); return; }
    setSaving(true);
    try {
      if (editing) await api.patch(`/items/${editing.id}`, form);
      else await api.post("/items", form);
      toast.success(editing ? "Item updated" : "Item created");
      setModal(false);
      load();
    } catch {
      toast.error("Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Delete item "${item.itmCode}"?`)) return;
    try {
      await api.delete(`/items/${item.id}`);
      toast.success("Item deleted");
      load();
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const filtered = items.filter((i) =>
    i.itmCode.toLowerCase().includes(search.toLowerCase()) ||
    (i.itmName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader title="Items" subtitle="Manage product master" action={{ label: "New Item", onClick: openCreate, icon: <Plus size={16} /> }} />
      <div className="mb-4">
        <Input placeholder="Search by code or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <Table
        loading={loading} data={filtered}
        columns={[
          { key: "itmCode", header: "Code" },
          { key: "itmName", header: "Name" },
          { key: "itmCategory", header: "Category" },
          { key: "itmUOM", header: "UOM" },
          { key: "isActive", header: "Active" },
          {
            key: "actions", header: "",
            render: (row) => (
              <div className="flex gap-2">
                <button onClick={() => openEdit(row)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(row)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ),
          },
        ]}
      />
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Item" : "New Item"}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Item Code *" value={form.itmCode} onChange={(e) => setForm({ ...form, itmCode: e.target.value })} disabled={!!editing} />
          <Input label="Item Name" value={form.itmName} onChange={(e) => setForm({ ...form, itmName: e.target.value })} />
          <Input label="Category" value={form.itmCategory} onChange={(e) => setForm({ ...form, itmCategory: e.target.value })} />
          <Input label="UOM" value={form.itmUOM} onChange={(e) => setForm({ ...form, itmUOM: e.target.value })} />
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
