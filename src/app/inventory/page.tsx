"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import { fetchStock, type StockItem } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { formatCurrency } from "@/lib/utils";

export default function InventoryPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
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

  const handleSearch = (val: string) => {
    setSearch(val);
    resetPage();
  };

  const filtered = stock.filter((s) =>
    s.itemCode.toLowerCase().includes(search.toLowerCase()) ||
    (s.item?.itmName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader title="Stock View" subtitle="Current inventory levels" />
      <div className="mb-4">
        <Input placeholder="Search by code or name..." value={search} onChange={(e) => handleSearch(e.target.value)} className="max-w-xs" />
      </div>
      <Table
        loading={loading} data={filtered}
        columns={[
          { key: "itemCode", header: "Item Code" },
          { key: "itmName", header: "Item Name", render: (r) => r.item?.itmName ?? "-" },
          { key: "itmUOM", header: "UOM", render: (r) => r.item?.itmUOM ?? "-" },
          { key: "quantity", header: "Qty", render: (r) => formatCurrency(r.quantity), className: "text-right" },
          { key: "unitCost", header: "Unit Cost", render: (r) => `৳ ${formatCurrency(r.unitCost)}`, className: "text-right" },
          { key: "totalValue", header: "Total Value", render: (r) => `৳ ${formatCurrency(r.totalValue)}`, className: "text-right" },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
    </AppLayout>
  );
}
