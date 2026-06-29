"use client";
import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Pagination from "@/components/ui/Pagination";
import NextImage from "next/image";
import { Plus, Edit2, Trash2, ImagePlus, X } from "lucide-react";
import {
  fetchItems,
  createItem,
  updateItem,
  deleteItem,
  uploadFile,
  type Item,
  type ItemPayload,
} from "./server";
import { fetchAllCategories, type Category } from "../categories/server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
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

const emptyForm: ItemPayload = {
  itmCode: "", itmName: "", itmCategory: "", itmType: "",
  itmUOM: "", itmRemarks: "", imageId: "", isActive: "Y",
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<ItemPayload>(emptyForm);

  // previewUrl is display-only — not sent in the payload
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { page, limit, meta, setMeta, setPage, setLimit, resetPage, refreshKey } = usePagination();

  const { can } = usePermissions();
  const canCreate = can("Items", "add");
  const canEdit = can("Items", "edit");
  const canDelete = can("Items", "delete");

  const load = () => {
    setLoading(true);
    fetchItems({ page, limit })
      .then(({ items, meta }) => { setItems(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey, setMeta]);
  useEffect(() => { fetchAllCategories().then(setCategories).catch(() => {}); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setPreviewUrl("");
    setModal(true);
  };

  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({
      itmCode:     item.itmCode,
      itmName:     item.itmName     ?? "",
      itmCategory: item.itmCategory ?? "",
      itmType:     item.itmType     ?? "",
      itmUOM:      item.itmUOM      ?? "",
      itmRemarks:  item.itmRemarks  ?? "",
      imageId:     item.imageId     ?? "",
      isActive:    item.isActive    ?? "Y",
    });
    // Show existing image from the joined media_files record
    setPreviewUrl(item.image?.fileUrl ?? "");
    setModal(true);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (jpg, png, gif, webp)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB");
      return;
    }

    setUploadingImage(true);
    try {
      // Upload to /upload → get back the full media_files DB record
      const mediaFile = await uploadFile(file);

      // Store the DB record UUID in the form (this is what gets saved to items.image_id)
      setForm((f) => ({ ...f, imageId: mediaFile.id }));
      // Use fileUrl for the preview thumbnail
      setPreviewUrl(mediaFile.fileUrl);
      toast.success("Image uploaded");
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearImage = () => {
    setForm((f) => ({ ...f, imageId: "" }));
    setPreviewUrl("");
  };

  const handleSave = async () => {
    if (!form.itmCode.trim()) { toast.error("Item code is required"); return; }
    if (!form.itmType)        { toast.error("Item type is required");  return; }
    if (!form.itmUOM)         { toast.error("UOM is required");        return; }
    if ((form.itmRemarks?.length ?? 0) > 500) {
      toast.error("Remarks must be 500 characters or fewer");
      return;
    }

    // Build payload — omit empty imageId so we don't send an invalid UUID
    const payload: ItemPayload = {
      ...form,
      imageId: form.imageId || undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { itmCode, ...updateFields } = payload;
        await updateItem(editing.id, updateFields);
      } else {
        await createItem(payload);
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
        action={canCreate ? { label: "New Item", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
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
          {
            key: "image", header: "",
            render: (r) => r.image?.fileUrl
              ? <NextImage src={r.image.fileUrl} alt={r.itmName ?? ""} width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
              : <div  className={`w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-800 text-xs font-semibold`}> {(() => {
                const name = r.itmName?.trim() || "";
                const words = name.split(/\s+/).filter(Boolean);
                return (words.length > 1
                  ? words.map(w => w.match(/[a-zA-Z]/)?.[0] || "").join("")
                  : name.replace(/[^a-zA-Z]/g, "").slice(0, 2)
                ).toUpperCase();
              })()}</div>,
          },
          { key: "itmCode",     header: "Code" },
          { key: "itmName",     header: "Name" },
          { key: "itmCategory", header: "Category" },
          { key: "itmType",     header: "Type", render: (r) => itmTypeLabel(r.itmType) },
          { key: "itmUOM",      header: "UOM" },
          { key: "isActive",    header: "Active" },
          {
            key: "actions", header: "",
            render: (row) => (
              <div className="flex gap-2">
                {canEdit && (
                  <button onClick={() => openEdit(row)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(row)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                )}
                {!canEdit && !canDelete && <span className="text-gray-300">—</span>}
              </div>
            ),
          },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Item" : "New Item"}>
        <div className="grid grid-cols-2 gap-4">
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

          {/* Image upload section */}
          <div className="col-span-2">
            <p className="text-sm font-medium text-gray-700 mb-2">Item Image</p>

            {previewUrl ? (
              <div className="flex items-start gap-4">
                <NextImage
                  src={previewUrl}
                  alt="Item preview"
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-lg object-cover border border-gray-200 shadow-sm"
                />
                <div className="flex flex-col gap-2 mt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:underline text-left"
                  >
                    Change image
                  </button>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="flex items-center gap-1 text-red-500 hover:underline"
                  >
                    <X size={12} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-5 py-4 text-sm text-gray-500 hover:border-primary-800 hover:text-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingImage ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Uploading…
                  </>
                ) : (
                  <>
                    <ImagePlus size={16} />
                    Upload Item Image
                    <span className="text-xs text-gray-400">(jpg, png, gif, webp · max 5 MB)</span>
                  </>
                )}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleImageSelect}
            />
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
