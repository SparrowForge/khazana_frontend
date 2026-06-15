"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Pagination from "@/components/ui/Pagination";
import { Plus } from "lucide-react";
import { fetchMoneyReceive, createMoneyReceive, fetchCustomers, type MoneyReceive, type Customer } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

const emptyForm = { receiptNo: "", receiptDate: new Date().toISOString().split("T")[0], customerCode: "", amount: "", paymentMethod: "Cash", description: "" };

export default function MoneyReceivePage() {
  const [records, setRecords] = useState<MoneyReceive[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchMoneyReceive({ page, limit })
      .then(({ items, meta }) => { setRecords(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey]);
  useEffect(() => { fetchCustomers().then(setCustomers).catch(() => {}); }, []);

  const handleSave = async () => {
    if (!form.customerCode || !form.amount) { toast.error("Customer and amount are required"); return; }
    setSaving(true);
    try {
      await createMoneyReceive({ ...form, amount: parseFloat(form.amount) });
      toast.success("Money receive recorded");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Money Receive" action={{ label: "New Receipt", onClick: () => { setForm(emptyForm); setModal(true); }, icon: <Plus size={16} /> }} />
      <Table loading={loading} data={records}
        columns={[
          { key: "receiptNo", header: "Receipt No" },
          { key: "receiptDate", header: "Date", render: (r) => formatDate(r.receiptDate) },
          { key: "customerCode", header: "Customer" },
          { key: "paymentMethod", header: "Method" },
          { key: "amount", header: "Amount", render: (r) => `৳ ${formatCurrency(r.amount)}`, className: "text-right" },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
      <Modal open={modal} onClose={() => setModal(false)} title="New Money Receive">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Receipt No" value={form.receiptNo} onChange={(e) => setForm({ ...form, receiptNo: e.target.value })} />
          <Input label="Date" type="date" value={form.receiptDate} onChange={(e) => setForm({ ...form, receiptDate: e.target.value })} />
          <Select label="Customer *" value={form.customerCode} onChange={(e) => setForm({ ...form, customerCode: e.target.value })}
            placeholder="Select customer..." options={customers.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} />
          <Input label="Amount *" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Select label="Payment Method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            options={[{ value: "Cash", label: "Cash" }, { value: "Cheque", label: "Cheque" }, { value: "Transfer", label: "Bank Transfer" }]} />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
