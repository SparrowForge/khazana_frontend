"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import { fetchSales, type Sale, type SalesTypeFilter } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

const TYPE_OPTIONS: { value: SalesTypeFilter; label: string }[] = [
  { value: "all", label: "All Sales" },
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit" },
  { value: "vat-cash", label: "VAT Cash" },
  { value: "vat-credit", label: "VAT Credit" },
  { value: "nc", label: "NC Adjustment" },
];

export default function SalesListPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<SalesTypeFilter>("all");
  const { page, limit, meta, setMeta, setPage, setLimit, resetPage, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchSales({ page, limit, type: typeFilter })
      .then(({ items, meta }) => { setSales(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, typeFilter, refreshKey, setMeta]);

  const handleSearch = (val: string) => { setSearch(val); resetPage(); };
  const handleTypeChange = (val: SalesTypeFilter) => { setTypeFilter(val); resetPage(); };

  const filtered = sales.filter((s) => {
    const haystack = `${s.invoiceNo ?? ""} ${s.customerName ?? ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <AppLayout>
      <PageHeader
        title="Sales List"
        action={{ label: "New Cash Sale", onClick: () => window.location.href = "/sales/cash" }}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search by invoice or customer..." value={search} onChange={(e) => handleSearch(e.target.value)} className="max-w-xs" />
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value as SalesTypeFilter)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <Table
        loading={loading}
        data={filtered}
        columns={[
          { key: "invoiceNo", header: "Invoice No", render: (r) => r.invoiceNo || "-" },
          { key: "date", header: "Date", render: (r) => formatDate(r.date ?? undefined) },
          { key: "type", header: "Type", render: (r) => r.type ?? "-" },
          { key: "customerName", header: "Customer", render: (r) => r.customerName || "-" },
          { key: "netAmount", header: "Amount", render: (r) => `৳ ${formatCurrency(r.netAmount ?? 0)}`, className: "text-right" },
          {
            key: "actions", header: "",
            render: (r) => (
              <Link href={`/sales/${r.id}`} className="text-primary-800 hover:underline text-xs">View</Link>
            ),
          },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
    </AppLayout>
  );
}
