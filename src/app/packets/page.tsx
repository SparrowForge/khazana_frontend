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
import { fetchPackets, createPacket, updatePacket, deletePacket, type Packet } from "./server";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

const emptyForm = { code: "", name: "", uom: "pcs", weight: "", rate: "", isActive: "1" };

export default function PacketsPage() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Packet | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchPackets().then(setPackets).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (p: Packet) => {
    setEditing(p);
    setForm({ code: p.code, name: p.name ?? "", uom: p.uom ?? "pcs", weight: String(p.weight ?? ""), rate: String(p.rate ?? ""), isActive: String(p.isActive ?? 1) });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.code) { toast.error("Code is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, weight: parseFloat(form.weight) || 0, rate: parseFloat(form.rate) || 0, isActive: parseInt(form.isActive) };
      if (editing) await updatePacket(editing.id, payload);
      else await createPacket(payload);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  const handleDelete = async (p: Packet) => {
    if (!confirm(`Delete "${p.code}"?`)) return;
    try { await deletePacket(p.id); toast.success("Deleted"); load(); }
    catch { toast.error("Failed to delete"); }
  };

  return (
    <AppLayout>
      <PageHeader title="Packet Info" action={{ label: "New Packet", onClick: openCreate, icon: <Plus size={16} /> }} />
      <Table loading={loading} data={packets}
        columns={[
          { key: "code", header: "Code" },
          { key: "name", header: "Name" },
          { key: "uom", header: "UOM" },
          { key: "weight", header: "Weight", render: (r) => formatCurrency(r.weight ?? 0), className: "text-right" },
          { key: "rate", header: "Rate", render: (r) => `৳ ${formatCurrency(r.rate ?? 0)}`, className: "text-right" },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-2">
              <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>
              <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          )},
        ]}
      />
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Packet" : "New Packet"}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Code *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editing} />
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="UOM" value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} />
          <Input label="Weight" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
          <Input label="Rate" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          <Select label="Active" value={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.value })} options={[{ value: "1", label: "Yes" }, { value: "0", label: "No" }]} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
