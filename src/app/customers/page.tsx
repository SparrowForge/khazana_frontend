"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import { Plus, Edit2, Trash2, Eye } from "lucide-react";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { fetchCustomers, fetchAllCustomers, createCustomer, updateCustomer, deleteCustomer, type Customer } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";
import type { ExportColumn } from "@/lib/export/reportExport";

const emptyForm = { code: "", name: "", mobile: "", address: "", email: "" };

const exportColumns: ExportColumn<Customer>[] = [
  { header: "Code", value: (r) => r.code },
  { header: "Name", value: (r) => r.name },
  { header: "Mobile", value: (r) => r.mobile ?? "-" },
  { header: "Address", value: (r) => r.address ?? "-" },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { page, limit, meta, setMeta, setPage, setLimit, resetPage, refreshKey } = usePagination();
  const { can } = usePermissions();
  const canAdd = can("Customers", "add");
  const canEdit = can("Customers", "edit");
  const canDelete = can("Customers", "delete");

  const load = () => {
    setLoading(true);
    fetchCustomers({ page, limit })
      .then(({ items, meta }) => { setCustomers(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey, setMeta]);

  // Full, unpaginated list backing Print/Excel/PDF — those need every matching
  // row, not just the page currently on screen.
  useEffect(() => {
    fetchAllCustomers().then(setAllCustomers).catch(() => {});
  }, [refreshKey]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ code: c.code, name: c.name, mobile: c.mobile ?? "", address: c.address ?? "", email: c.email ?? "" }); setModal(true); };

  const handleSave = async () => {
    // Code is allocated by the backend on create, so it is not asked for here.
    if (!form.name || !form.mobile) { toast.error("Name and mobile are required"); return; }
    setSaving(true);
    try {
      if (editing) await updateCustomer(editing.code, form);
      else await createCustomer(form);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save")); } finally { setSaving(false); }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete "${c.name}"?`)) return;
    try { await deleteCustomer(c.code); toast.success("Deleted"); load(); }
    catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSearch = (val: string) => { setSearch(val); resetPage(); };

  const matchesSearch = (c: Customer) =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.mobile ?? "").includes(search);

  const filtered = customers.filter(matchesSearch);
  const exportRows = allCustomers.filter(matchesSearch);

  return (
    <AppLayout>
      <PageHeader title="Customers" action={canAdd ? { label: "New Customer", onClick: openCreate, icon: <Plus size={16} /> } : undefined} />
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Input placeholder="Search by code, name, or mobile..." value={search} onChange={(e) => handleSearch(e.target.value)} className="max-w-xs" />
        <ReportExportButtons
          rows={exportRows}
          columns={exportColumns}
          meta={{ title: "Customer List", subtitle: `As at ${formatDate(new Date())}` }}
        />
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
              {canEdit && <button onClick={() => openEdit(r)} className="text-primary-600 hover:text-primary-800"><Edit2 size={14} /></button>}
              {canDelete && <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
            </div>
          )},
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Customer" : "New Customer"}>
        <div className="grid grid-cols-2 gap-4">
          {/* Read-only either way: on create the backend allocates the next
              C-nnnn, and on edit the code is the record's identifier. */}
          <Input label="Code" value={form.code} placeholder="Auto-generated" disabled readOnly />
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Mobile *" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
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
