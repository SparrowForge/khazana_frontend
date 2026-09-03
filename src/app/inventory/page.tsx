"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { fetchStock, fetchAllStock, type StockItem } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";

const tableColumns = [
  { key: "itemCode", header: "Item Code", render: (r: StockItem) => r.item?.itmCode ?? "-" },
  { key: "itmName", header: "Item Name", render: (r: StockItem) => r.item?.itmName ?? "-" },
  { key: "itmUOM", header: "UOM", render: (r: StockItem) => r.item?.itmUOM ?? "-" },
  { key: "quantity", header: "Qty", render: (r: StockItem) => formatCurrency(r.quantity), className: "text-right" },
  { key: "unitCost", header: "Unit Cost", render: (r: StockItem) => `৳ ${formatCurrency(r.unitCost)}`, className: "text-right" },
  { key: "totalValue", header: "Total Value", render: (r: StockItem) => `৳ ${formatCurrency(r.totalValue)}`, className: "text-right" },
];

const exportColumns: ExportColumn<StockItem>[] = [
  { header: "Item Code", value: (r) => r.item?.itmCode ?? "-" },
  { header: "Item Name", value: (r) => r.item?.itmName ?? "-" },
  { header: "UOM", value: (r) => r.item?.itmUOM ?? "-" },
  { header: "Qty", value: (r) => r.quantity, numeric: true },
  { header: "Unit Cost", value: (r) => r.unitCost, numeric: true },
  { header: "Total Value", value: (r) => r.totalValue, numeric: true },
];

export default function InventoryPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [allStock, setAllStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { page, limit, meta, setMeta, setPage, setLimit, resetPage, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchStock({ page, limit })
      .then(({ items, meta }) => { setStock(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey, setMeta]);

  // Full, unpaginated list backing Preview/Print/Excel/PDF — those need every
  // matching row, not just the page currently on screen.
  useEffect(() => {
    fetchAllStock().then(setAllStock).catch(() => {});
  }, [refreshKey]);

  const handleSearch = (val: string) => {
    setSearch(val);
    resetPage();
  };

  const matchesSearch = (s: StockItem) =>
    (s.item?.itmCode ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.item?.itmName ?? "").toLowerCase().includes(search.toLowerCase());

  const filtered = stock.filter(matchesSearch);
  const exportRows = allStock.filter(matchesSearch);

  return (
    <AppLayout>
      <PageHeader title="Stock View" subtitle="Current inventory levels" />
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Input placeholder="Search by code or name..." value={search} onChange={(e) => handleSearch(e.target.value)} className="max-w-xs" />
        <ReportExportButtons
          rows={exportRows}
          columns={exportColumns}
          meta={{ title: "Stock View", subtitle: `As at ${formatDate(new Date())}` }}
          showPreview
        />
      </div>
      <Table loading={loading} data={filtered} columns={tableColumns} />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
    </AppLayout>
  );
}
