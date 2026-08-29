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
import { fetchUoms, createUom, updateUom, deleteUom, type Uom } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

/**
 * Units of measure — the list every item form's UOM dropdown is filled from.
 *
 * The unit is stored on an item as text, so this screen governs what may be
 * PICKED, not what an item is bound to. That is why the code is fixed after
 * creation (items already carry it, and nothing rewrites them) and why the API
 * refuses to delete a unit still in use.
 */
export default function UomPage() {
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Uom | null>(null);
  const [form, setForm] = useState({ code: "", name: "", remarks: "" });
  const [saving, setSaving] = useState(false);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();
  const { can } = usePermissions();
  const canAdd = can("UOM", "add");
  const canEdit = can("UOM", "edit");
  const canDelete = can("UOM", "delete");

  const load = () => {
    setLoading(true);
    fetchUoms({ page, limit })
      .then(({ items, meta }) => { setUoms(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey, setMeta]);

  const openCreate = () => { setEditing(null); setForm({ code: "", name: "", remarks: "" }); setModal(true); };
  const openEdit = (u: Uom) => { setEditing(u); setForm({ code: u.code, name: u.name ?? "", remarks: u.remarks ?? "" }); setModal(true); };

  const handleSave = async () => {
    const code = form.code.trim();
    if (!code) { toast.error("Unit is required"); return; }
    setSaving(true);
    try {
      if (editing) await updateUom(editing.id, { name: form.name, remarks: form.remarks });
      else await createUom({ code, name: form.name.trim() || code, remarks: form.remarks });
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save")); } finally { setSaving(false); }
  };

  const handleDelete = async (u: Uom) => {
    if (!confirm(`Delete "${u.code}"?`)) return;
    // A unit in use comes back 409 with the item count — surfaced as-is, so the
    // message says why rather than just "failed".
    try { await deleteUom(u.id); toast.success("Deleted"); load(); }
    catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Unit of Measure"
        subtitle="The units offered when an item is created — Pcs, KG, Box…"
        action={canAdd ? { label: "New UOM", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />
      <Table loading={loading} data={uoms}
        columns={[
          { key: "code", header: "Unit", render: (r) => <span className="font-medium">{r.code}</span> },
          { key: "name", header: "Name", render: (r) => r.name || "-" },
          { key: "remarks", header: "Remarks", render: (r) => r.remarks || "-" },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-2">
              {canEdit && <button onClick={() => openEdit(r)} className="text-primary-600 hover:text-primary-800" title="Edit"><Edit2 size={14} /></button>}
              {canDelete && <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>}
            </div>
          )},
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit UOM" : "New UOM"}>
        <div className="space-y-4">
          <Input
            label="Unit *"
            placeholder="Box"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            disabled={!!editing}
          />
          {editing && (
            <p className="-mt-2 text-xs text-gray-500">
              The unit itself can&apos;t be changed — items already store it as text. Delete and re-add instead.
            </p>
          )}
          <Input label="Name" placeholder="Box" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
