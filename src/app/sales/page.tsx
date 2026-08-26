"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { fetchSales, deleteCreditSale, type Sale } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";
import { Edit2, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

const exportColumns: ExportColumn<Sale>[] = [
  { header: "Invoice No", value: (r) => r.invoiceNo || "-" },
  { header: "Date", value: (r) => formatDate(r.date ?? undefined) },
  { header: "Customer", value: (r) => r.customerName || "-" },
  { header: "Amount", value: (r) => Number(r.netAmount ?? 0), numeric: true },
];

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

/** Credit sales only — cash / POS billing is listed on the POS Sales screen. */
export default function SalesListPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);
  const { page, limit, meta, setMeta, setPage, setLimit, resetPage, refreshKey } = usePagination();
  const { can } = usePermissions();
  const canDelete = can("CreditSales", "delete");

  const handleDelete = async (s: Sale) => {
    if (!confirm(`Delete credit sale "${s.invoiceNo}"? Stock will be restored.`)) return;
    try {
      await deleteCreditSale(s.id);
      toast.success("Sale deleted");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete"));
    }
  };

  const load = () => {
    setLoading(true);
    fetchSales({ page, limit, type: "credit", fromDate, toDate })
      .then(({ items, meta }) => { setSales(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, fromDate, toDate, refreshKey, setMeta]);

  const handleSearch = (val: string) => { setSearch(val); resetPage(); };
  const handleFromDate = (val: string) => { setFromDate(val); resetPage(); };
  const handleToDate = (val: string) => { setToDate(val); resetPage(); };

  const filtered = sales.filter((s) => {
    const haystack = `${s.invoiceNo ?? ""} ${s.customerName ?? ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const amountTotal = filtered.reduce((sum, s) => sum + Number(s.netAmount ?? 0), 0);

  return (
    <AppLayout>
      <PageHeader
        title="Credit Sales List"
        subtitle="Credit sale invoices"
        action={{ label: "New Credit Sale", onClick: () => router.push("/sales/credit") }}
      />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="From Date" type="date" value={fromDate} onChange={(e) => handleFromDate(e.target.value)} />
          <Input label="To Date" type="date" value={toDate} onChange={(e) => handleToDate(e.target.value)} />
          <Input
            label="Search"
            placeholder="Invoice or customer..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <ReportExportButtons
          rows={filtered}
          columns={exportColumns}
          meta={{
            title: "Credit Sales List",
            subtitle: `${formatDate(fromDate)} → ${formatDate(toDate)}`,
            footer: ["", "", "Total", amountTotal.toFixed(2)],
          }}
        />
      </div>
      <Table
        loading={loading}
        data={filtered}
        columns={[
          { key: "invoiceNo", header: "Invoice No", render: (r) => r.invoiceNo || "-" },
          { key: "date", header: "Date", render: (r) => formatDate(r.date ?? undefined) },
          { key: "customerName", header: "Customer", render: (r) => r.customerName || "-" },
          { key: "netAmount", header: "Amount", render: (r) => `৳ ${formatCurrency(r.netAmount ?? 0)}`, className: "text-right" },
          {
            key: "actions", header: "",
            render: (r) => (
              <div className="flex items-center gap-3">
                <Link href={`/sales/credit/invoice/${r.id}`} className="text-primary-800 hover:underline text-xs">
                  Invoice
                </Link>
                <Link href={`/sales/credit/${r.id}`} className="text-primary-800 hover:underline text-xs" title="Edit">
                  <Edit2 size={14} />
                </Link>
                {canDelete && (
                  <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600" title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
    </AppLayout>
  );
}
