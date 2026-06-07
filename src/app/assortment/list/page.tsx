"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import api from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Assortment { id: string; code?: string; date?: string; type?: string; netAmt?: number; }

export default function AssortmentListPage() {
  const [list, setList] = useState<Assortment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/assortment").then((res) => setList(res.data.data ?? res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Assortment List" action={{ label: "New Assortment", onClick: () => window.location.href = "/assortment" }} />
      <Table loading={loading} data={list}
        columns={[
          { key: "code", header: "Code" },
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "type", header: "Type" },
          { key: "netAmt", header: "Amount", render: (r) => `৳ ${formatCurrency(r.netAmt ?? 0)}`, className: "text-right" },
        ]}
      />
    </AppLayout>
  );
}
