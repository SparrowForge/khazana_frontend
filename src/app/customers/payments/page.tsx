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
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { fetchPayments, createPayment, fetchCustomers, type Payment, type Customer } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import type { ExportColumn } from "@/lib/export/reportExport";
import { posBanksApi, POS_PAY_MODES, type PosBank } from "@/lib/services/pos.service";

const emptyForm = { customerId: "", receiveDate: new Date().toISOString().split("T")[0], receiveAmount: "", tType: "Cash", bankName: "" };

const reportColumns: ExportColumn<Payment>[] = [
  { header: "Date", value: (r) => formatDate(r.receiveDate) },
  { header: "Receipt No", value: (r) => r.moneyReceptNo ?? "-" },
  { header: "Customer", value: (r) => r.customer?.name ?? r.customer?.code ?? "-" },
  { header: "Type", value: (r) => r.tType ?? "-" },
  { header: "Amount", value: (r) => r.receiveAmount ?? 0, numeric: true },
  { header: "Bank", value: (r) => r.bankName ?? "-" },
];

export default function CustomerPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [banks, setBanks] = useState<PosBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState<Payment | null>(null);
  const { can } = usePermissions();
  const canAdd = can("Customers", "add");

  const load = () => {
    setLoading(true);
    fetchPayments().then(setPayments).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetchCustomers().then(setCustomers).catch(() => {});
    posBanksApi.getAll().then(setBanks).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.customerId || !form.receiveAmount) { toast.error("Customer and amount are required"); return; }
    setSaving(true);
    try {
      await createPayment({ ...form, receiveAmount: parseFloat(form.receiveAmount) });
      toast.success("Money Receipt recorded");
      setModal(false); load();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save")); } finally { setSaving(false); }
  };

  const openReport = (p: Payment) => { setReport(p); setReportOpen(true); };

  return (
    <AppLayout>
      <PageHeader title="Customer Money Receipt" action={canAdd ? { label: "New Money Receipt", onClick: () => { setForm(emptyForm); setModal(true); }, icon: <Plus size={16} /> } : undefined} />
      <Table loading={loading} data={payments}
        columns={[
          { key: "receiveDate", header: "Date", render: (r) => formatDate(r.receiveDate) },
          {
            key: "moneyReceptNo", header: "Receipt No",
            render: (r) => r.moneyReceptNo ? (
              <button onClick={() => openReport(r)} className="text-primary-800 hover:underline font-medium">
                {r.moneyReceptNo}
              </button>
            ) : "-",
          },
          { key: "customer", header: "Customer", render: (r) => r.customer?.name ?? r.customer?.code ?? "" },
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
          <Select label="Payment Type" value={form.tType}
            onChange={(e) => {
              const next = e.target.value;
              setForm({ ...form, tType: next, bankName: next === "Card" ? form.bankName : "" });
            }}
            options={POS_PAY_MODES.map((m) => ({ value: m, label: m }))} />
          {form.tType === "Card" && (
            <Select label="Bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="Select bank..." options={banks.map((b) => ({ value: b.name, label: b.name }))} />
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Money Receipt Report" size="lg">
        {report && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
              <div><span className="text-gray-500">Receipt No:</span> <span className="font-medium">{report.moneyReceptNo}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(report.receiveDate)}</span></div>
              <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{report.customer?.name ?? report.customer?.code ?? "-"}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className="font-medium">{report.tType ?? "-"}</span></div>
              <div><span className="text-gray-500">Amount:</span> <span className="font-medium">৳ {formatCurrency(report.receiveAmount ?? 0)}</span></div>
              <div><span className="text-gray-500">Bank:</span> <span className="font-medium">{report.bankName ?? "-"}</span></div>
            </div>
            <div className="flex justify-end">
              <ReportExportButtons
                rows={[report]}
                columns={reportColumns}
                meta={{
                  title: "Money Receipt",
                  subtitle: `Receipt No: ${report.moneyReceptNo} · ${formatDate(report.receiveDate)}`,
                }}
                showPreview
              />
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
