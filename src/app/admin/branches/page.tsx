"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Plus, Edit2 } from "lucide-react";
import { fetchBranches, createBranch, updateBranch, type Branch } from "./server";
import toast from "react-hot-toast";

const emptyForm = { branchCode: "", branchName: "", address: "", vatNo: "", mobileNo: "" };

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchBranches().then(setBranches).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (b: Branch) => { setEditing(b); setForm({ branchCode: b.branchCode, branchName: b.branchName, address: b.address ?? "", vatNo: b.vatNo ?? "", mobileNo: b.mobileNo ?? "" }); setModal(true); };

  const handleSave = async () => {
    if (!form.branchCode || !form.branchName) { toast.error("Code and name are required"); return; }
    setSaving(true);
    try {
      if (editing) await updateBranch(editing.id, form);
      else await createBranch(form);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Branches" action={{ label: "New Branch", onClick: openCreate, icon: <Plus size={16} /> }} />
      <Table loading={loading} data={branches}
        columns={[
          { key: "branchCode", header: "Code" },
          { key: "branchName", header: "Branch Name" },
          { key: "address", header: "Address" },
          { key: "vatNo", header: "VAT No" },
          { key: "mobileNo", header: "Mobile" },
          { key: "actions", header: "", render: (r) => <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button> },
        ]}
      />
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Branch" : "New Branch"}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Branch Code *" value={form.branchCode} onChange={(e) => setForm({ ...form, branchCode: e.target.value })} disabled={!!editing} />
          <Input label="Branch Name *" value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} />
          <Input label="VAT No" value={form.vatNo} onChange={(e) => setForm({ ...form, vatNo: e.target.value })} />
          <Input label="Mobile" value={form.mobileNo} onChange={(e) => setForm({ ...form, mobileNo: e.target.value })} />
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
