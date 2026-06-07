"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import ReportFilter from "@/components/reports/ReportFilter";
import api from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

interface SalesReportRow { id: number; invNo?: string; date?: string; customerName?: string; totalAmount?: number; discount?: number; netAmount?: number; saleType?: string; }

export default function SalesReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<SalesReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const runReport = () => {
    setLoading(true);
    api.get(`/reports/sales?from=${from}&to=${to}`)
      .then((res) => setData(res.data.data ?? res.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  const totalNet = data.reduce((s, r) => s + (r.netAmount ?? 0), 0);

  return (
    <AppLayout>
      <PageHeader title="Sales Report" />
      <ReportFilter fromDate={from} toDate={to} onFromDate={setFrom} onToDate={setTo} onRun={runReport} loading={loading} />
      {data.length > 0 && (
        <p className="mb-3 text-sm text-gray-500">
          {data.length} records | Total: <span className="font-bold text-gray-800">৳ {formatCurrency(totalNet)}</span>
        </p>
      )}
      <Table loading={loading} data={data}
        columns={[
          { key: "invNo", header: "Invoice No" },
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "customerName", header: "Customer" },
          { key: "saleType", header: "Type" },
          { key: "totalAmount", header: "Gross", render: (r) => `৳ ${formatCurrency(r.totalAmount ?? 0)}`, className: "text-right" },
          { key: "discount", header: "Discount", render: (r) => `৳ ${formatCurrency(r.discount ?? 0)}`, className: "text-right" },
          { key: "netAmount", header: "Net", render: (r) => `৳ ${formatCurrency(r.netAmount ?? 0)}`, className: "text-right font-semibold" },
        ]}
      />
    </AppLayout>
  );
}
