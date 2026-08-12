"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import { fetchNCReport, type NCReport, type NCReportRow } from "./server";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import { formatCurrency } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";

const formatDate = (dateString: string | Date) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

const q = (n: number) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : v.toFixed(2);
};
const amt = (n: number) => formatCurrency(n ?? 0);

const exportColumns: ExportColumn<NCReportRow>[] = [
  { header: "Date", value: (r) => formatDate(r.date) },
  { header: "Invoice No", value: (r) => r.invoiceNo },
  { header: "Item Name", value: (r) => r.itemName, width: 28 },
  { header: "UOM", value: (r) => r.uom },
  { header: "Qty", value: (r) => r.qty, numeric: true },
  { header: "Amount", value: (r) => r.amount, numeric: true },
  { header: "Name", value: (r) => r.name },
  { header: "Referenced", value: (r) => r.reference },
  { header: "Outlet", value: (r) => r.outlet },
];

export default function NCReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Branch (Outlet) — defaults to the logged-in session branch; user may switch it.
  const [branchId, setBranchId] = useState("");
  const [report, setReport] = useState<NCReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches({ page: 1, limit: 100 })
      .then(({ items }) => setBranches(items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionBranchId) setBranchId((b) => b || sessionBranchId);
  }, [sessionBranchId]);

  const runReport = () => {
    setLoading(true);
    fetchNCReport(fromDate, toDate, branchId || undefined)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  const subtitle = useMemo(
    () =>
      [report?.branch.name, `${formatDate(fromDate)} — ${formatDate(toDate)}`]
        .filter(Boolean)
        .join(" · "),
    [report, fromDate, toDate],
  );

  return (
    <AppLayout>
      <PageHeader title="NC Report" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-gray-200">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Branch"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          placeholder="All branches"
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-48"
        />
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={report?.items ?? []}
          columns={exportColumns}
          meta={{ title: "NC Report", subtitle }}
        />
      </div>

      {report && (
        <>
          <style>{`
            @media print {
              @page { size: landscape; margin: 8mm; }
              body * { visibility: hidden !important; }
              #report, #report * { visibility: visible !important; }
              #report { position: absolute; top: 0; left: 0; width: 100%; }
              .no-print { display: none !important; }
            }
          `}</style>
          <Report data={report} />
        </>
      )}
    </AppLayout>
  );
}

function Report({ data }: { data: NCReport }) {
  const { branch, items, totals } = data;

  return (
    <div id="report" className="bg-white text-black text-[11px] border border-gray-300 p-4 overflow-x-auto">
      <div className="text-center mb-3">
        <div className="font-extrabold text-[16px] italic">Khazana Mithai Limited</div>
        <div className="font-semibold">NC Report</div>
        <div className="text-[10px]">{branch.name}</div>
        <div className="mt-1 font-semibold">
          NC Details From {formatDate(data.fromDate)} to {formatDate(data.toDate)}
        </div>
      </div>

      <table className="w-full border-collapse border border-black">
        <thead>
          <tr className="border-b border-black font-bold text-center">
            <th className="border border-gray-400 px-1 py-0.5">Date</th>
            <th className="border border-gray-400 px-1 py-0.5">Invoice No</th>
            <th className="border border-gray-400 px-1 py-0.5 text-left">Item Name</th>
            <th className="border border-gray-400 px-1 py-0.5">UOM</th>
            <th className="border border-gray-400 px-1 py-0.5">Qty</th>
            <th className="border border-gray-400 px-1 py-0.5">Amount</th>
            <th className="border border-gray-400 px-1 py-0.5">Name</th>
            <th className="border border-gray-400 px-1 py-0.5">Referenced</th>
            <th className="border border-gray-400 px-1 py-0.5">Outlet</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={`${r.invoiceNo}-${i}`} className="border-b border-gray-200">
              <td className="border border-gray-200 px-1 whitespace-nowrap">{formatDate(r.date)}</td>
              <td className="border border-gray-200 px-1 whitespace-nowrap">{r.invoiceNo}</td>
              <td className="border border-gray-200 px-1 text-left whitespace-nowrap">{r.itemName}</td>
              <td className="border border-gray-200 px-1 text-center">{r.uom}</td>
              <td className="border border-gray-200 px-1 text-right">{q(r.qty)}</td>
              <td className="border border-gray-200 px-1 text-right">{amt(r.amount)}</td>
              <td className="border border-gray-200 px-1">{r.name}</td>
              <td className="border border-gray-200 px-1">{r.reference}</td>
              <td className="border border-gray-200 px-1">{r.outlet}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="border border-gray-200 px-2 py-3 text-center text-gray-500" colSpan={9}>
                No NC entries found for the selected filters.
              </td>
            </tr>
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td className="border border-gray-300 px-1" colSpan={4}>Total</td>
              <td className="border border-gray-300 px-1 text-right">{q(totals.qty)}</td>
              <td className="border border-gray-300 px-1 text-right">{amt(totals.amount)}</td>
              <td className="border border-gray-300 px-1" colSpan={3}></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
