"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { fetchStockReport, type StockRow } from "./server";
import { formatCurrency } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";

const exportColumns: ExportColumn<StockRow>[] = [
  { header: "Item Code", value: (r) => r.itemCode },
  { header: "Item Name", value: (r) => r.itemName },
  { header: "UOM", value: (r) => r.uom },
  { header: "Opening", value: (r) => r.openingQty ?? 0, numeric: true },
  { header: "In", value: (r) => r.inwardQty ?? 0, numeric: true },
  { header: "Out", value: (r) => r.outwardQty ?? 0, numeric: true },
  { header: "Closing", value: (r) => r.closingQty ?? 0, numeric: true },
];

export default function StockReportPage() {
  const [data, setData] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);

  const runReport = () => {
    setLoading(true);
    fetchStockReport().then(setData).catch(() => setData([])).finally(() => setLoading(false));
  };

  return (
    <AppLayout>
      <PageHeader title="Stock Report" />
      <div className="mb-5 p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-3 flex-wrap">
        <Button onClick={runReport} loading={loading}>Run Report</Button>
        <ReportExportButtons
          rows={data}
          columns={exportColumns}
          meta={{
            title: "Stock Report",
            subtitle: `As at ${new Date().toLocaleDateString("en-BD")}`,
          }}
        />
      </div>
      <Table loading={loading} data={data}
        columns={[
          { key: "itemCode", header: "Item Code" },
          { key: "itemName", header: "Item Name" },
          { key: "uom", header: "UOM" },
          { key: "openingQty", header: "Opening", render: (r) => formatCurrency(r.openingQty ?? 0), className: "text-right" },
          { key: "inwardQty", header: "In", render: (r) => formatCurrency(r.inwardQty ?? 0), className: "text-right" },
          { key: "outwardQty", header: "Out", render: (r) => formatCurrency(r.outwardQty ?? 0), className: "text-right" },
          { key: "closingQty", header: "Closing", render: (r) => formatCurrency(r.closingQty ?? 0), className: "text-right font-semibold" },
        ]}
      />
    </AppLayout>
  );
}
