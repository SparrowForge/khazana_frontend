"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import ReportFilter from "@/components/reports/ReportFilter";
import { fetchItemSalesReport, type ItemSalesRow } from "./server";
import { formatCurrency } from "@/lib/utils";

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

  return (
    <AppLayout>
      <PageHeader title="Item-wise Sales Report" />
      <ReportFilter fromDate={from} toDate={to} onFromDate={setFrom} onToDate={setTo} onRun={runReport} loading={loading} />
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
