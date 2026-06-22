"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Pagination from "@/components/ui/Pagination";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { fetchItems, createItem, updateItem, deleteItem, type Item, type ItemPayload } from "./server";
import { fetchAllCategories, type Category } from "../categories/server";
import { usePagination } from "@/hooks/usePagination";
import toast from "react-hot-toast";

const ITEM_TYPES = [
  { value: "RW",  label: "RW — Raw Material" },
  { value: "FG",  label: "FG — Finished Goods" },
  { value: "SFG", label: "SFG — Semi-Finished Goods" },
  { value: "P",   label: "P — Packaging" },
];

const UOM_OPTIONS = [
  { value: "Pcs", label: "Pcs" },
  { value: "Cup", label: "Cup" },
  { value: "gm",  label: "gm" },
  { value: "KG",  label: "KG" },
  { value: "LT",  label: "LT" },
  { value: "ml",  label: "ml" },
];

const emptyItem: ItemPayload = {
  itmCode: "",
  itmName: "",
  itmCategory: "",
  itmType: "",
  itmUOM: "",
  itmRemarks: "",
  isActive: "Y",
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<ItemPayload>(emptyItem);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const { page, limit, meta, setMeta, setPage, setLimit, resetPage, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchItems({ page, limit })
      .then(({ items, meta }) => { setItems(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey]);
  useEffect(() => { fetchAllCategories().then(setCategories).catch(() => {}); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyItem); setModal(true); };
  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({
      itmCode:     item.itmCode,
      itmName:     item.itmName     ?? "",
      itmCategory: item.itmCategory ?? "",
      itmType:     item.itmType     ?? "",
      itmUOM:      item.itmUOM      ?? "",
      itmRemarks:  item.itmRemarks  ?? "",
      isActive:    item.isActive    ?? "Y",
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.itmCode.trim())  { toast.error("Item code is required");  return; }
    if (!form.itmType)         { toast.error("Item type is required");   return; }
    if (!form.itmUOM)          { toast.error("UOM is required");         return; }
    if ((form.itmRemarks?.length ?? 0) > 500) { toast.error("Remarks must be 500 characters or fewer"); return; }

    setSaving(true);
    try {
      if (editing) {
        const { itmCode: _, ...updateFields } = form;
        await updateItem(editing.id, updateFields);
      } else {
        await createItem(form);
      }
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
      await deleteItem(item.id);
      toast.success("Item deleted");
      load();
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const handleSearch = (val: string) => { setSearch(val); resetPage(); };

  const filtered = items.filter((i) =>
    i.itmCode.toLowerCase().includes(search.toLowerCase()) ||
    (i.itmName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const itmTypeLabel = (val?: string) =>
    ITEM_TYPES.find((t) => t.value === val)?.label.split(" — ")[1] ?? val ?? "—";

  return (
    <AppLayout>
      <PageHeader
        title="Items"
        subtitle="Manage product master"
        action={{ label: "New Item", onClick: openCreate, icon: <Plus size={16} /> }}
      />

      <div className="mb-4">
        <Input
          placeholder="Search by code or name..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Table
        loading={loading}
        data={filtered}
        columns={[
          { key: "itmCode",     header: "Code" },
          { key: "itmName",     header: "Name" },
          { key: "itmCategory", header: "Category" },
          { key: "itmType",     header: "Type",   render: (r) => itmTypeLabel(r.itmType) },
          { key: "itmUOM",      header: "UOM" },
          { key: "isActive",    header: "Active" },
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
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Item" : "New Item"}>
        <div className="grid grid-cols-2 gap-4">
          {/* Row 1: Code + Name */}
          <Input
            label="Item Code *"
            value={form.itmCode}
            onChange={(e) => setForm({ ...form, itmCode: e.target.value })}
            disabled={!!editing}
            placeholder="e.g. ITM-001"
          />
          <Input
            label="Item Name"
            value={form.itmName ?? ""}
            onChange={(e) => setForm({ ...form, itmName: e.target.value })}
            placeholder="e.g. Kaju Barfi"
          />

          {/* Row 2: Category + Item Type */}
          <Select
            label="Category"
            value={form.itmCategory ?? ""}
            onChange={(e) => setForm({ ...form, itmCategory: e.target.value })}
            options={[
              { value: "", label: "— Select Category —" },
              ...categories.map((c) => ({
                value: c.name ?? c.code,
                label: c.name ? `${c.code} - ${c.name}` : c.code,
              })),
            ]}
          />
          <Select
            label="Item Type *"
            value={form.itmType ?? ""}
            onChange={(e) => setForm({ ...form, itmType: e.target.value })}
            options={[{ value: "", label: "— Select Type —" }, ...ITEM_TYPES]}
          />

          {/* Row 3: UOM + Active */}
          <Select
            label="UOM *"
            value={form.itmUOM ?? ""}
            onChange={(e) => setForm({ ...form, itmUOM: e.target.value })}
            options={[{ value: "", label: "— Select UOM —" }, ...UOM_OPTIONS]}
          />
          <Select
            label="Active"
            value={form.isActive ?? "Y"}
            onChange={(e) => setForm({ ...form, isActive: e.target.value })}
            options={[{ value: "Y", label: "Yes" }, { value: "N", label: "No" }]}
          />

          {/* Row 4: Remarks — full width */}
          <div className="col-span-2">
            <Textarea
              id="itmRemarks"
              label="Remarks"
              rows={3}
              maxLength={500}
              placeholder="Enter any item remarks here..."
              value={form.itmRemarks ?? ""}
              onChange={(e) => setForm({ ...form, itmRemarks: e.target.value })}
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {(form.itmRemarks?.length ?? 0)}/500
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>
            {editing ? "Update" : "Create Item"}
          </Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
