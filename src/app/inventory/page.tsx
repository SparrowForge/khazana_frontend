"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface StockItem { id: number; itemCode: string; item?: { itmName?: string; itmUOM?: string }; quantity: number; unitCost: number; totalValue: number; }

export default function InventoryPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/inventory").then((res) => setStock(res.data.data ?? res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = stock.filter((s) =>
    s.itemCode.toLowerCase().includes(search.toLowerCase()) ||
    (s.item?.itmName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader title="Stock View" subtitle="Current inventory levels" />
      <div className="mb-4">
        <Input placeholder="Search by code or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
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
    </AppLayout>
  );
}
