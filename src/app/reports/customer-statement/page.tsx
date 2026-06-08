"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import ReportFilter from "@/components/reports/ReportFilter";
import Select from "@/components/ui/Select";
import { fetchCustomers, fetchCustomerStatement, type Customer, type StatementRow } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function CustomerStatementPage() {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [customerCode, setCustomerCode] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [data, setData] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCustomers().then(setCustomers).catch(() => {});
  }, []);

  const runReport = () => {
    setLoading(true);
    fetchCustomerStatement(from, to, customerCode).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  };

  return (
    <AppLayout>
      <PageHeader title="Customer Statement" />
      <ReportFilter fromDate={from} toDate={to} onFromDate={setFrom} onToDate={setTo} onRun={runReport} loading={loading}
        extra={
          <Select label="Customer" value={customerCode} onChange={(e) => setCustomerCode(e.target.value)}
            placeholder="All customers" options={customers.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
            className="w-56" />
        }
      />
      <Table loading={loading} data={data}
        columns={[
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "invoiceNo", header: "Invoice No" },
          { key: "description", header: "Description" },
          { key: "debit", header: "Debit", render: (r) => r.debit ? `৳ ${formatCurrency(r.debit)}` : "-", className: "text-right" },
          { key: "credit", header: "Credit", render: (r) => r.credit ? `৳ ${formatCurrency(r.credit)}` : "-", className: "text-right" },
          { key: "balance", header: "Balance", render: (r) => `৳ ${formatCurrency(r.balance ?? 0)}`, className: "text-right font-semibold" },
        ]}
      />
    </AppLayout>
  );
}
