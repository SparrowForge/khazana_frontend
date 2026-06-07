"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface PacketStock { id: number; code: string; name?: string; totalReceived?: number; totalIssued?: number; balance?: number; }

export default function PacketStockPage() {
  const [stock, setStock] = useState<PacketStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/packets/stock").then((res) => setStock(res.data.data ?? res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Packet Stock" subtitle="Current packet inventory" />
      <Table loading={loading} data={stock}
        columns={[
          { key: "code", header: "Code" },
          { key: "name", header: "Name" },
          { key: "totalReceived", header: "Received", render: (r) => formatCurrency(r.totalReceived ?? 0), className: "text-right" },
          { key: "totalIssued", header: "Issued", render: (r) => formatCurrency(r.totalIssued ?? 0), className: "text-right" },
          { key: "balance", header: "Balance", render: (r) => formatCurrency(r.balance ?? 0), className: "text-right font-semibold" },
        ]}
      />
    </AppLayout>
  );
}
