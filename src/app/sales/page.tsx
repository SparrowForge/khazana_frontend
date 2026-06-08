"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import { fetchSales, type Sale } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function SalesListPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSales().then(setSales).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = sales.filter((s) => {
    const inv = s.invNo ?? s.invoiceNo ?? "";
    return inv.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <AppLayout>
      <PageHeader
        title="Sales List"
        action={{ label: "New Cash Sale", onClick: () => window.location.href = "/sales/cash" }}
      />
      <div className="mb-4">
        <Input placeholder="Search by invoice no..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <Table
        loading={loading}
        data={filtered}
        columns={[
          { key: "invNo", header: "Invoice No", render: (r) => r.invNo ?? r.invoiceNo ?? "-" },
          { key: "date", header: "Date", render: (r) => formatDate(r.invDate ?? r.somstrDate ?? r.date) },
          { key: "type", header: "Type", render: (r) => r.type ?? "Cash" },
          { key: "netAmount", header: "Amount", render: (r) => `৳ ${formatCurrency(r.netAmount ?? r.somstrNetAmt ?? 0)}`, className: "text-right" },
          {
            key: "actions", header: "",
            render: (r) => (
              <Link href={`/sales/${r.id}`} className="text-primary-800 hover:underline text-xs">View</Link>
            ),
          },
        ]}
      />
    </AppLayout>
  );
}
