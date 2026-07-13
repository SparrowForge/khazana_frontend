"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import ReportFilter from "@/components/reports/ReportFilter";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { fetchSalesReport, type SalesReportRow } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";

const exportColumns: ExportColumn<SalesReportRow>[] = [
  { header: "Invoice No", value: (r) => r.invNo },
  { header: "Date", value: (r) => formatDate(r.date) },
  { header: "Customer", value: (r) => r.customerName },
  { header: "Type", value: (r) => r.saleType },
  { header: "Gross", value: (r) => r.totalAmount ?? 0, numeric: true },
  { header: "Discount", value: (r) => r.discount ?? 0, numeric: true },
  { header: "Net", value: (r) => r.netAmount ?? 0, numeric: true },
];

export default function SalesReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<SalesReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const runReport = () => {
    setLoading(true);
    fetchSalesReport(from, to).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  };

  const totalNet = data.reduce((s, r) => s + (r.netAmount ?? 0), 0);

  return (
    <AppLayout>
      <PageHeader title="Sales Report" />
      <ReportFilter fromDate={from} toDate={to} onFromDate={setFrom} onToDate={setTo} onRun={runReport} loading={loading} />
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        {data.length > 0 ? (
          <p className="text-sm text-gray-500">
            {data.length} records | Total: <span className="font-bold text-gray-800">৳ {formatCurrency(totalNet)}</span>
          </p>
        ) : <span />}
        <ReportExportButtons
          rows={data}
          columns={exportColumns}
          meta={{
            title: "Sales Report",
            subtitle: `${formatDate(from)} — ${formatDate(to)}`,
            footer: ["", "", "", "Total", "", "", formatCurrency(totalNet)],
          }}
        />
      </div>
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
