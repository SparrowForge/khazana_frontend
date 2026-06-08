"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import { fetchStockReport, type StockRow } from "./server";
import { formatCurrency } from "@/lib/utils";

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
      <div className="mb-5 p-4 bg-white rounded-lg border border-gray-200">
        <Button onClick={runReport} loading={loading}>Run Report</Button>
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
