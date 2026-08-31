"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { Edit2, Trash2, Plus } from "lucide-react";
import { fetchNcAdjustments, deleteNcAdjustment, ncTotalQty, ncTotalValue, type NC } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import type { ExportColumn } from "@/lib/export/reportExport";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

const exportColumns: ExportColumn<NC>[] = [
  { header: "Date", value: (r) => formatDate(r.ncmstrDate) },
  { header: "NC Code", value: (r) => r.ncmstrCode ?? "-" },
  { header: "Name", value: (r) => r.ncmstrName ?? "-" },
  { header: "Contact", value: (r) => r.ncmstrContactNo ?? "-" },
  { header: "Reference", value: (r) => r.ncmstrReference ?? "-" },
  { header: "Qty", value: (r) => ncTotalQty(r), numeric: true },
  { header: "Value", value: (r) => ncTotalValue(r), numeric: true },
];

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

export default function NCAdjustmentListPage() {
  const router = useRouter();
  const [list, setList] = useState<NC[]>([]);
  const [loading, setLoading] = useState(true);
  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);

  const { can } = usePermissions();
  const canAdd = can("NCAdjustment", "add");
  const canEdit = can("NCAdjustment", "edit");
  const canDelete = can("NCAdjustment", "delete");

  const load = () => {
    setLoading(true);
    fetchNcAdjustments(fromDate, toDate).then(setList).catch(() => {}).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [fromDate, toDate]);

  const handleDelete = async (nc: NC) => {
    if (!confirm(`Delete NC adjustment "${nc.ncmstrCode ?? nc.id}"? Master + details are removed and the stock it issued is restored.`)) return;
    try {
      await deleteNcAdjustment(nc.id);
      toast.success("NC Adjustment deleted");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete"));
    }
  };

  const qtyTotal = list.reduce((sum, nc) => sum + ncTotalQty(nc), 0);
  const valueTotal = list.reduce((sum, nc) => sum + ncTotalValue(nc), 0);

  return (
    <AppLayout>
      <PageHeader
        title="NC Adjustment List"
        action={canAdd ? { label: "New NC", onClick: () => router.push("/nc-adjustment"), icon: <Plus size={16} /> } : undefined}
      />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }}
          />
          <Input
            label="To Date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <ReportExportButtons
          rows={list}
          columns={exportColumns}
          meta={{
            title: "NC Adjustment List",
            subtitle: `${formatDate(fromDate)} → ${formatDate(toDate)}`,
            footer: ["", "", "", "", "Total", qtyTotal.toFixed(2), valueTotal.toFixed(2)],
          }}
        />
      </div>
      <Table loading={loading} data={list}
        columns={[
          { key: "ncmstrDate", header: "Date", render: (r) => formatDate(r.ncmstrDate) },
          // The code opens the printable invoice — the same hand-off a sales
          // invoice number gives from the sales list.
          { key: "ncmstrCode", header: "NC Code", render: (r) => (
            <Link href={`/nc-adjustment/invoice/${r.id}`} className="text-primary-800 hover:underline font-medium" title="View invoice">
              {r.ncmstrCode ?? "—"}
            </Link>
          )},
          { key: "ncmstrName", header: "Name" },
          { key: "ncmstrContactNo", header: "Contact" },
          { key: "ncmstrReference", header: "Reference" },
          { key: "value", header: "Value", render: (r) => `৳ ${formatCurrency(ncTotalValue(r))}`, className: "text-right" },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-2">
              {canEdit && <button onClick={() => router.push(`/nc-adjustment/${r.id}`)} className="text-primary-600 hover:text-primary-800" title="Edit"><Edit2 size={14} /></button>}
              {canDelete && <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>}
              {!canEdit && !canDelete && <span className="text-gray-300">—</span>}
            </div>
          )},
        ]}
      />
    </AppLayout>
  );
}
