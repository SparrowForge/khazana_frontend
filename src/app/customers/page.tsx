"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Plus, Edit2, Trash2, Eye } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";

interface Customer { id: number; code: string; name: string; mobile?: string; address?: string; email?: string; }

const emptyForm = { code: "", name: "", mobile: "", address: "", email: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/customers?limit=500").then((res) => setCustomers(res.data.data ?? res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ code: c.code, name: c.name, mobile: c.mobile ?? "", address: c.address ?? "", email: c.email ?? "" }); setModal(true); };

  const handleSave = async () => {
    if (!form.code || !form.name) { toast.error("Code and name are required"); return; }
    setSaving(true);
    try {
      if (editing) await api.patch(`/customers/${editing.id}`, form);
      else await api.post("/customers", form);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete "${c.name}"?`)) return;
    try { await api.delete(`/customers/${c.id}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed to delete"); }
  };

  const filtered = customers.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.mobile ?? "").includes(search)
  );

  return (
    <AppLayout>
      <PageHeader title="Customers" action={{ label: "New Customer", onClick: openCreate, icon: <Plus size={16} /> }} />
      <div className="mb-4">
        <Input placeholder="Search by code, name, or mobile..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <Table loading={loading} data={filtered}
        columns={[
          { key: "code", header: "Code" },
          { key: "name", header: "Name" },
          { key: "mobile", header: "Mobile" },
          { key: "address", header: "Address" },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-2">
              <Link href={`/customers/${r.id}/ledger`} className="text-green-600 hover:text-green-800"><Eye size={14} /></Link>
              <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>
              <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          )},
        ]}
      />
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Customer" : "New Customer"}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Code *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editing} />
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="col-span-2" />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
