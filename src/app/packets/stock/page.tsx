"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import { fetchPacketStock, type PacketStock } from "./server";
import { formatCurrency } from "@/lib/utils";

export default function PacketStockPage() {
  const [stock, setStock] = useState<PacketStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPacketStock().then(setStock).catch(() => {}).finally(() => setLoading(false));
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
