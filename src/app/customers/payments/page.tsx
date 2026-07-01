"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus } from "lucide-react";
import { fetchPayments, createPayment, fetchCustomers, type Payment, type Customer } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";

const emptyForm = { customerId: "", receiveDate: new Date().toISOString().split("T")[0], receiveAmount: "", tType: "Cash", moneyReceptNo: "", bankName: "" };

export default function CustomerPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { can } = usePermissions();
  const canAdd = can("Customers", "add");

  const load = () => {
    setLoading(true);
    fetchPayments().then(setPayments).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetchCustomers().then(setCustomers).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.customerId || !form.receiveAmount) { toast.error("Customer and amount are required"); return; }
    setSaving(true);
    try {
      await createPayment({ ...form, receiveAmount: parseFloat(form.receiveAmount) });
      toast.success("Money Receipt recorded");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Customer Money Receipt" action={canAdd ? { label: "New Money Receipt", onClick: () => { setForm(emptyForm); setModal(true); }, icon: <Plus size={16} /> } : undefined} />
      <Table loading={loading} data={payments}
        columns={[
          { key: "moneyReceptNo", header: "Receipt No" },
          { key: "customer", header: "Customer", render: (r) => r.customer?.name ?? r.customer?.code ?? "" },
          { key: "receiveDate", header: "Date", render: (r) => formatDate(r.receiveDate) },
          { key: "tType", header: "Type" },
          { key: "receiveAmount", header: "Amount", render: (r) => `৳ ${formatCurrency(r.receiveAmount ?? 0)}`, className: "text-right" },
          { key: "bankName", header: "Bank" },
        ]}
      />
      <Modal open={modal} onClose={() => setModal(false)} title="New Money Receipt">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Customer *" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            placeholder="Select customer..." options={customers.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))} />
          <Input label="Date" type="date" value={form.receiveDate} onChange={(e) => setForm({ ...form, receiveDate: e.target.value })} />
          <Input label="Amount *" type="number" min="0" value={form.receiveAmount} onChange={(e) => setForm({ ...form, receiveAmount: e.target.value })} />
          <Select label="Payment Type" value={form.tType} onChange={(e) => setForm({ ...form, tType: e.target.value })}
            options={[{ value: "Cash", label: "Cash" }, { value: "Cheque", label: "Cheque" }, { value: "Transfer", label: "Bank Transfer" }]} />
          <Input label="Receipt No" value={form.moneyReceptNo} onChange={(e) => setForm({ ...form, moneyReceptNo: e.target.value })} />
          <Input label="Bank Name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
