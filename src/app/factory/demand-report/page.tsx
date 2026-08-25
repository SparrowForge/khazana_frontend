"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import { fetchDemandReport, type DemandReport, type DemandReportRow } from "./server";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import { formatCurrency } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import type { ExportColumn } from "@/lib/export/reportExport";

const formatDate = (dateString: string | Date) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day}-${month}-${date.getUTCFullYear()}`;
};

/** The printed form is headed "Demand Report of <date>". A range keeps both
 *  ends so the heading never misrepresents what was queried. */
const periodLabel = (fromDate: string, toDate: string) =>
  fromDate === toDate ? formatDate(fromDate) : `${formatDate(fromDate)} — ${formatDate(toDate)}`;

// Blank cells, not zeros — the sheet is read by scanning for the numbers.
const q = (n: number | undefined) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "" : String(v);
};
const money = (n: number) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : formatCurrency(v);
};

export default function DemandReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Who raised the demand — empty means every branch, one column each.
  const [fromBranchId, setFromBranchId] = useState("");
  // Who it was raised on — the factory, i.e. the branch the user is logged in at.
  const [toBranchId, setToBranchId] = useState("");
  const [report, setReport] = useState<DemandReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches({ page: 1, limit: 100 })
      .then(({ items }) => setBranches(items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionBranchId) setToBranchId((b) => b || sessionBranchId);
  }, [sessionBranchId]);

  const runReport = () => {
    setLoading(true);
    fetchDemandReport(fromDate, toDate, fromBranchId || undefined, toBranchId || undefined)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        toast.error(getErrorMessage(err, "Failed to load the report"));
      })
      .finally(() => setLoading(false));
  };

  // Branch columns are only known once the report has run, so the export spec
  // is built from what came back rather than declared up front.
  const exportColumns = useMemo<ExportColumn<DemandReportRow>[]>(() => {
    const cols = report?.branches ?? [];
    return [
      { header: "SL", value: (r) => r.sl, numeric: true },
      { header: "Item Name", value: (r) => r.itemName, width: 30 },
      { header: "Rate", value: (r) => r.rate, numeric: true },
      ...cols.map((b) => ({
        header: b.code || b.name,
        value: (r: DemandReportRow) => r.qtyByBranch[b.id] ?? 0,
        numeric: true,
      })),
      { header: "Total Qty", value: (r) => r.totalQty, numeric: true },
      { header: "Amount", value: (r) => r.amount, numeric: true },
    ];
  }, [report]);

  const subtitle = useMemo(
    () =>
      [report?.fromBranch.name, report?.toBranch.name, periodLabel(fromDate, toDate)]
        .filter(Boolean)
        .join(" · "),
    [report, fromDate, toDate],
  );

  return (
    <AppLayout>
      <PageHeader title="Demand Report" subtitle="Branch demands for a date, one column per branch" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Demand From Branch"
          value={fromBranchId}
          onChange={(e) => setFromBranchId(e.target.value)}
          placeholder="All Branch"
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-48"
        />
        <Select
          label="Demand To Branch"
          value={toBranchId}
          onChange={(e) => setToBranchId(e.target.value)}
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
          meta={{ title: "Demand Report", subtitle }}
        />
      </div>

      {report && (
        <>
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 8mm; }
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

function Report({ data }: { data: DemandReport }) {
  const { company, branches, items, totals } = data;

  return (
    <div id="report" className="bg-white text-black text-[10px] border border-sage-400 p-5 overflow-x-auto">
      {/* ── Letterhead, as on the printed form ── */}
      <div className="text-center">
        <div className="font-bold text-[17px]">{company.name}</div>
        {company.address && <div className="text-[10px]">{company.address}</div>}
      </div>

      {/* The form said "Invoice"; this sheet says what it actually is. The date
          sits on the right exactly where the paper form has its Date: field. */}
      <div className="flex items-end justify-between mt-2 mb-2">
        <div className="flex-1" />
        <div className="font-semibold text-[13px]">
          Demand Report of {periodLabel(data.fromDate, data.toDate)}
        </div>
        <div className="flex-1 text-right text-[11px]">
          Date: <span className="font-medium">{formatDate(data.toDate)}</span>
        </div>
      </div>

      {/* An all-blank sheet reads as a broken report rather than an empty one —
          the item rows and branch columns render either way, so the fact that
          nothing matched has to be said out loud. */}
      {totals.totalQty === 0 && (
        <div className="no-print mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          No demand orders were found for this date range
          {branches.length ? ` (${branches.map((b) => b.code || b.name).join(", ")})` : ""}. The item list and
          branch columns below are the blank sheet — check the From/To dates against the demand order dates.
        </div>
      )}

      <table className="w-full border-collapse border border-black">
        <thead>
          <tr className="font-semibold text-center">
            <th className="border border-black px-1 py-1 w-8">SL</th>
            <th className="border border-black px-2 py-1 text-left">Item Name</th>
            <th className="border border-black px-1 py-1 w-16">Rate</th>
            {branches.map((b) => (
              <th key={b.id} className="border border-black px-1 py-1 w-16 whitespace-nowrap">
                {b.code || b.name}
              </th>
            ))}
            <th className="border border-black px-1 py-1 w-16">Total</th>
            <th className="border border-black px-1 py-1 w-20">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.itemCode}>
              <td className="border border-black px-1 text-center text-gray-600">{r.sl}</td>
              <td className="border border-black px-2 whitespace-nowrap">{r.itemName}</td>
              <td className="border border-black px-1 text-right">{r.rate ? formatCurrency(r.rate) : ""}</td>
              {branches.map((b) => (
                <td key={b.id} className="border border-black px-1 text-right">{q(r.qtyByBranch[b.id])}</td>
              ))}
              <td className="border border-black px-1 text-right font-medium">{q(r.totalQty)}</td>
              <td className="border border-black px-1 text-right">{r.amount ? formatCurrency(r.amount) : ""}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="border border-black px-2 py-3 text-center text-gray-500" colSpan={branches.length + 5}>
                No items found.
              </td>
            </tr>
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr className="font-bold">
              <td className="border border-black px-1" colSpan={3}>Total</td>
              {branches.map((b) => (
                <td key={b.id} className="border border-black px-1 text-right">{q(totals.qtyByBranch[b.id])}</td>
              ))}
              <td className="border border-black px-1 text-right">{q(totals.totalQty)}</td>
              <td className="border border-black px-1 text-right">{money(totals.amount)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
