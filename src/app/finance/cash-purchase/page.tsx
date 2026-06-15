"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import { Plus } from "lucide-react";
import { fetchCashPurchases, createCashPurchase, type CashPurchase } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

const emptyForm = { voucherNo: "", voucherDate: new Date().toISOString().split("T")[0], supplier: "", amount: "", description: "" };

export default function CashPurchasePage() {
  const [records, setRecords] = useState<CashPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchCashPurchases({ page, limit })
      .then(({ items, meta }) => { setRecords(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey]);

  const handleSave = async () => {
    if (!form.amount) { toast.error("Amount is required"); return; }
    setSaving(true);
    try {
      await createCashPurchase({ ...form, amount: parseFloat(form.amount) });
      toast.success("Cash purchase recorded");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Cash Purchase" action={{ label: "New Purchase", onClick: () => { setForm(emptyForm); setModal(true); }, icon: <Plus size={16} /> }} />
      <Table loading={loading} data={records}
        columns={[
          { key: "voucherNo", header: "Voucher No" },
          { key: "voucherDate", header: "Date", render: (r) => formatDate(r.voucherDate) },
          { key: "supplier", header: "Supplier" },
          { key: "amount", header: "Amount", render: (r) => `৳ ${formatCurrency(r.amount)}`, className: "text-right" },
          { key: "description", header: "Description" },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
      <Modal open={modal} onClose={() => setModal(false)} title="New Cash Purchase">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Voucher No" value={form.voucherNo} onChange={(e) => setForm({ ...form, voucherNo: e.target.value })} />
          <Input label="Date" type="date" value={form.voucherDate} onChange={(e) => setForm({ ...form, voucherDate: e.target.value })} />
          <Input label="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          <Input label="Amount *" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="col-span-2" />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
