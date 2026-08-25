"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { posSalesApi, type PosSale } from "@/lib/services/pos.service";
import { usePermissions } from "@/hooks/usePermissions";
import { Edit2, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";
import toast from "react-hot-toast";

function formatDT(iso: string) {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${h}:${min} ${ampm}`;
}

const exportColumns: ExportColumn<PosSale>[] = [
  { header: "Invoice No", value: (r) => r.invoiceNo },
  { header: "Date & Time", value: (r) => formatDT(r.dateTime) },
  { header: "Type", value: (r) => r.salesType },
  { header: "Total", value: (r) => Number(r.totalAmount), numeric: true },
  { header: "VAT", value: (r) => Number(r.vatAmount), numeric: true },
  { header: "Payable", value: (r) => Number(r.payableAmount), numeric: true },
  { header: "Served By", value: (r) => r.servedBy },
];

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

export default function PosSalesListPage() {
  const router = useRouter();
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);
  const { can } = usePermissions();
  const canEdit = can("POSSales", "edit");
  const canDelete = can("POSSales", "delete");

  const load = () => {
    setLoading(true);
    posSalesApi.getAll({ fromDate, toDate })
      .then(setSales)
      .catch(() => toast.error("Failed to load sales"))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [fromDate, toDate]);

  const payableTotal = sales.reduce((s, r) => s + Number(r.payableAmount ?? 0), 0);

  const handleDelete = async (s: PosSale) => {
    if (!confirm(`Delete POS sale "${s.invoiceNo}"? Stock will be restored.`)) return;
    try {
      await posSalesApi.remove(s.id);
      toast.success("Sale deleted");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete"));
    }
  };

  return (
    <AppLayout>
      <PageHeader title="POS Sales" subtitle="All billing transactions" />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <ReportExportButtons
          rows={sales}
          columns={exportColumns}
          meta={{
            title: "POS Sales",
            subtitle: `${formatDate(fromDate)} → ${formatDate(toDate)}`,
            footer: ["", "", "Total", "", "", payableTotal.toFixed(2), ""],
          }}
        />
      </div>
      <div className="bg-white rounded-xl border border-sage-300 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
        ) : sales.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No sales in this date range</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sage-100 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Invoice No</th>
                <th className="px-5 py-3 text-left font-medium">Date & Time</th>
                <th className="px-5 py-3 text-left font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">VAT</th>
                <th className="px-5 py-3 text-right font-medium">Payable</th>
                <th className="px-5 py-3 text-left font-medium">Served By</th>
                <th className="px-5 py-3 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-sage-100 transition-colors">
                  <td className="px-5 py-3 font-mono font-bold text-primary-700">{s.invoiceNo}</td>
                  <td className="px-5 py-3 text-gray-600">{formatDT(s.dateTime)}</td>
                  <td className="px-5 py-3 text-gray-600">{s.salesType}</td>
                  <td className="px-5 py-3 text-right text-gray-700">৳{Number(s.totalAmount).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">৳{Number(s.vatAmount).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800">৳{Number(s.payableAmount).toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-600">{s.servedBy}</td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => router.push(`/pos/invoice/${s.id}`)}
                        className="text-primary-700 hover:underline text-xs font-medium"
                      >
                        View Invoice
                      </button>
                       {canEdit && <button onClick={() => router.push(`/pos/${s.id}`)} className="text-primary-600 hover:text-primary-800"><Edit2 size={14} /></button>}
                       {canDelete && <button onClick={() => handleDelete(s)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
                       {!canEdit && !canDelete && <span className="text-gray-300">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
