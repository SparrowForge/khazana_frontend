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
import { fetchBanks, createBank, updateBank, deleteBank, type Bank } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

export default function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { can } = usePermissions();
  const canAdd = can("Bank", "add");
  const canEdit = can("Bank", "edit");
  const canDelete = can("Bank", "delete");
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchBanks({ page, limit })
      .then(({ items, meta }) => { setBanks(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey, setMeta]);

  const openCreate = () => { setEditing(null); setName(""); setModal(true); };
  const openEdit = (b: Bank) => { setEditing(b); setName(b.name ?? ""); setModal(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Bank name is required"); return; }
    setSaving(true);
    try {
      if (editing) await updateBank(editing.id, name.trim());
      else await createBank(name.trim());
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  const handleDelete = async (b: Bank) => {
    if (!confirm(`Delete bank "${b.name}"?`)) return;
    try {
      await deleteBank(b.id);
      toast.success("Bank deleted");
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to delete");
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Banks" action={canAdd ? { label: "New Bank", onClick: openCreate, icon: <Plus size={16} /> } : undefined} />
      <Table loading={loading} data={banks}
        columns={[
          { key: "name", header: "Bank Name" },
          { key: "createBy", header: "Created By" },
          { key: "createDate", header: "Created On", render: (r) => r.createDate ? formatDate(r.createDate) : "—" },
          {
            key: "actions", header: "", className: "text-right",
            render: (r) => (
              <div className="flex items-center justify-end gap-3">
                {canEdit && <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>}
                {canDelete && <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
                {!canEdit && !canDelete && <span className="text-gray-300">—</span>}
              </div>
            ),
          },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Bank" : "New Bank"}>
        <Input label="Bank Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. UCB" autoFocus />
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
