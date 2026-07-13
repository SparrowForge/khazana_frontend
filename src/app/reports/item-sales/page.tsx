"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import ReportFilter from "@/components/reports/ReportFilter";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { fetchItemSalesReport, type ItemSalesRow } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";

const exportColumns: ExportColumn<ItemSalesRow>[] = [
  { header: "Item Code", value: (r) => r.itemCode },
  { header: "Item Name", value: (r) => r.itemName },
  { header: "UOM", value: (r) => r.uom },
  { header: "Total Qty", value: (r) => r.totalQty ?? 0, numeric: true },
  { header: "Total Amount", value: (r) => r.totalAmount ?? 0, numeric: true },
];

export default function ItemSalesReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ItemSalesRow[]>([]);
  const [loading, setLoading] = useState(false);

  const runReport = () => {
    setLoading(true);
    fetchItemSalesReport(from, to).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  };

  const totalAmount = data.reduce((s, r) => s + (r.totalAmount ?? 0), 0);

  return (
    <AppLayout>
      <PageHeader title="Item-wise Sales Report" />
      <ReportFilter fromDate={from} toDate={to} onFromDate={setFrom} onToDate={setTo} onRun={runReport} loading={loading} />
      <div className="mb-3 flex justify-end">
        <ReportExportButtons
          rows={data}
          columns={exportColumns}
          meta={{
            title: "Item-wise Sales Report",
            subtitle: `${formatDate(from)} — ${formatDate(to)}`,
            footer: ["", "", "", "Total", formatCurrency(totalAmount)],
          }}
        />
      </div>
      <Table loading={loading} data={data}
        columns={[
          { key: "itemCode", header: "Item Code" },
          { key: "itemName", header: "Item Name" },
          { key: "uom", header: "UOM" },
          { key: "totalQty", header: "Total Qty", render: (r) => formatCurrency(r.totalQty ?? 0), className: "text-right" },
          { key: "totalAmount", header: "Total Amount", render: (r) => `৳ ${formatCurrency(r.totalAmount ?? 0)}`, className: "text-right font-semibold" },
        ]}
      />
    </AppLayout>
  );
}
