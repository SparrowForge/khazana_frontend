"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit2, Trash2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { fetchAssortments, deleteAssortment, type Assortment } from "./server";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

const exportColumns: ExportColumn<Assortment>[] = [
  { header: "Date", value: (r) => formatDate(r.date) },
  { header: "Code", value: (r) => r.code ?? "-" },
  { header: "Type", value: (r) => r.type ?? "-" },
  { header: "Amount", value: (r) => Number(r.netAmt ?? 0), numeric: true },
];

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

export default function AssortmentListPage() {
  const router = useRouter();
  const [list, setList] = useState<Assortment[]>([]);
  const [loading, setLoading] = useState(true);
  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);
  const { can } = usePermissions();
  const canEdit = can("Assortment", "edit");
  const canDelete = can("Assortment", "delete");

  const load = () => {
    setLoading(true);
    fetchAssortments({ fromDate, toDate }).then(setList).catch(() => {}).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [fromDate, toDate]);

  const handleDelete = async (a: Assortment) => {
    if (!confirm(`Delete assortment "${a.code ?? a.id}"? Master + details are removed and its deducted stock is restored.`)) return;
    try {
      await deleteAssortment(a.id);
      toast.success("Assortment deleted");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete"));
    }
  };

  const amountTotal = list.reduce((sum, a) => sum + Number(a.netAmt ?? 0), 0);

  return (
    <AppLayout>
      <PageHeader title="Assortment List" action={{ label: "New Assortment", onClick: () => router.push("/assortment") }} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }} />
          <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <ReportExportButtons
          rows={list}
          columns={exportColumns}
          meta={{
            title: "Assortment List",
            subtitle: `${formatDate(fromDate)} → ${formatDate(toDate)}`,
            footer: ["", "", "Total", amountTotal.toFixed(2)],
          }}
        />
      </div>
      <Table loading={loading} data={list}
        columns={[
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "code", header: "Code" },
          { key: "type", header: "Type" },
          { key: "netAmt", header: "Amount", render: (r) => `৳ ${formatCurrency(r.netAmt ?? 0)}`, className: "text-right" },
          {
            key: "actions", header: "",
            render: (r) => (
              <div className="flex gap-2">
                {canEdit && (
                  <Link href={`/assortment/${r.id}`} className="text-primary-800 hover:underline text-xs" title="Edit">
                    <Edit2 size={14} />
                  </Link>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600" title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
                {!canEdit && !canDelete && <span className="text-gray-300">—</span>}
              </div>
            ),
          },
        ]}
      />
    </AppLayout>
  );
}
