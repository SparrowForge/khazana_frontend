"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import {
  fetchDiscountSummary,
  type DiscountSummary,
  type DiscountSummaryRow,
} from "./server";
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

const amt = (n: number) => formatCurrency(n ?? 0);
/** The rate reads as a plain number on the sheet — "20", not "20.00". */
const pct = (n: number) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "" : String(v);
};
/** The letterhead names the outlet the way the printed sheet does. */
const branchLine = (name: string) => (!name || name === "All Branches" ? name : `${name} Branch`);

const exportColumns: ExportColumn<DiscountSummaryRow>[] = [
  { header: "Date", value: (r) => formatDate(r.date) },
  { header: "Invoice No", value: (r) => r.invoiceNo, width: 22 },
  { header: "Amount", value: (r) => r.amount, numeric: true },
  { header: "Discount(%)", value: (r) => r.discountPercent, numeric: true },
  { header: "Discount", value: (r) => r.discount, numeric: true },
  { header: "Contact No.", value: (r) => r.contactNo, width: 16 },
  { header: "Remarks", value: (r) => r.remarks, width: 28 },
  { header: "Outlet", value: (r) => r.outlet, width: 18 },
];

export default function DiscountSummaryPage() {
  const today = new Date().toISOString().split("T")[0];
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Branch (Outlet) — defaults to the logged-in session branch; user may switch it.
  const [branchId, setBranchId] = useState("");
  const [report, setReport] = useState<DiscountSummary | null>(null);
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
    fetchDiscountSummary(fromDate, toDate, branchId || undefined)
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
      <PageHeader title="Discount Summary" />

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
          meta={{ title: "Discount Summary", subtitle }}
        />
      </div>

      {report && (
        <>
          <style>{`
            @media print {
              @page { size: portrait; margin: 8mm; }
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

function Report({ data }: { data: DiscountSummary }) {
  const { branch, items, totals } = data;

  return (
    <div id="report" className="bg-white text-black text-[11px] border border-gray-300 p-6 overflow-x-auto">
      {/* Letterhead — company, outlet and outlet address, as on the printed sheet. */}
      <div className="text-center">
        <div className="font-extrabold text-[18px] italic">Khazana Mithai Limited.</div>
        <div className="font-semibold text-[12px] italic">{branchLine(branch.name)}</div>
        {branch.address && <div className="font-semibold text-[11px] italic">{branch.address}</div>}
      </div>

      <div className="border-t border-dotted border-black my-3" />

      <div className="text-center font-bold italic text-[13px] mb-3">
        Daily Discount Summary On {formatDate(data.fromDate)} To {formatDate(data.toDate)}
      </div>

      <table className="w-full border-collapse border border-black">
        <thead>
          <tr className="border-b border-black font-semibold">
            <th className="border border-gray-400 px-1 py-1 text-left">Sl No.</th>
            <th className="border border-gray-400 px-1 py-1 text-left">Date</th>
            <th className="border border-gray-400 px-1 py-1 text-left">Invoice No</th>
            <th className="border border-gray-400 px-1 py-1 text-right">Amount</th>
            <th className="border border-gray-400 px-1 py-1 text-right">Discount(%)</th>
            <th className="border border-gray-400 px-1 py-1 text-right">Discount</th>
            <th className="border border-gray-400 px-1 py-1 text-left">Contact No.</th>
            <th className="border border-gray-400 px-1 py-1 text-left">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={`${r.invoiceNo}-${i}`} className="border-b border-dotted border-gray-400">
              <td className="border-x border-gray-300 px-1">{i + 1}</td>
              <td className="border-x border-gray-300 px-1 whitespace-nowrap">{formatDate(r.date)}</td>
              <td className="border-x border-gray-300 px-1 whitespace-nowrap">{r.invoiceNo}</td>
              <td className="border-x border-gray-300 px-1 text-right">{amt(r.amount)}</td>
              <td className="border-x border-gray-300 px-1 text-right">{pct(r.discountPercent)}</td>
              <td className="border-x border-gray-300 px-1 text-right">{amt(r.discount)}</td>
              <td className="border-x border-gray-300 px-1 whitespace-nowrap">{r.contactNo}</td>
              <td className="border-x border-gray-300 px-1">{r.remarks}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="border border-gray-200 px-2 py-3 text-center text-gray-500" colSpan={8}>
                No discounted invoices found for the selected filters.
              </td>
            </tr>
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td className="border border-gray-300 px-1" colSpan={3}>Total ({items.length} invoices)</td>
              <td className="border border-gray-300 px-1 text-right">{amt(totals.amount)}</td>
              <td className="border border-gray-300 px-1"></td>
              <td className="border border-gray-300 px-1 text-right">{amt(totals.discount)}</td>
              <td className="border border-gray-300 px-1" colSpan={2}></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
