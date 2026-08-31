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
  fetchBranchwiseDelivery,
  type BranchwiseDeliveryReport,
  type BranchwiseDeliveryRow,
} from "./server";
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

/** The legacy sheet is headed "For The Month August 2026" when the range covers
 *  exactly one calendar month, which is how the factory normally runs it. Any
 *  other range prints as a span so the heading never misrepresents the query. */
const periodLabel = (fromDate: string, toDate: string) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const isMonth =
    from.getUTCDate() === 1 &&
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth() &&
    to.getUTCDate() === new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)).getUTCDate();
  if (isMonth) {
    return `For The Month ${from.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${from.getUTCFullYear()}`;
  }
  return fromDate === toDate
    ? `On ${formatDate(fromDate)}`
    : `From ${formatDate(fromDate)} To ${formatDate(toDate)}`;
};

/** Day columns read as bare day numbers on a single-month sheet (1…31, as the
 *  legacy report prints them); a range straddling months needs the month too,
 *  or day 1 would appear twice with nothing to tell the two apart. */
const dayHeader = (days: string[]) => {
  const months = new Set(days.map((d) => d.slice(0, 7)));
  return (iso: string) => {
    const d = new Date(iso);
    const day = d.getUTCDate();
    return months.size > 1 ? `${day}/${d.getUTCMonth() + 1}` : String(day);
  };
};

// A dash where nothing was delivered — the sheet is mostly empty cells, and
// zeros everywhere would drown the numbers that matter.
const q = (n: number | undefined) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : v.toFixed(2);
};
const amt = (n: number) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : formatCurrency(v);
};

/** Defaults to the current calendar month — the period this sheet is run for. */
const getDefaultMonth = () => {
  const today = new Date();
  const first = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const last = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0));
  return { fromDate: first.toISOString().split("T")[0], toDate: last.toISOString().split("T")[0] };
};

export default function BranchwiseDeliveryReportPage() {
  const defaults = getDefaultMonth();
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Issuing branch — where the delivery goes OUT from. Defaults to the branch
  // the user logged in at; they may point it at another branch.
  const [issueBranchId, setIssueBranchId] = useState("");
  // Receiving branch — empty means every branch ("All Branch").
  const [receiveBranchId, setReceiveBranchId] = useState("");
  const [report, setReport] = useState<BranchwiseDeliveryReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches({ page: 1, limit: 100 })
      .then(({ items }) => setBranches(items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionBranchId) setIssueBranchId((b) => b || sessionBranchId);
  }, [sessionBranchId]);

  const runReport = () => {
    setLoading(true);
    fetchBranchwiseDelivery(fromDate, toDate, issueBranchId || undefined, receiveBranchId || undefined)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        toast.error(getErrorMessage(err, "Failed to load the report"));
      })
      .finally(() => setLoading(false));
  };

  // Day columns are only known once the report has run, so the export spec is
  // built from the returned days rather than declared up front.
  const exportColumns = useMemo<ExportColumn<BranchwiseDeliveryRow>[]>(() => {
    const days = report?.days ?? [];
    const label = dayHeader(days);
    return [
      { header: "SL", value: (r) => r.sl, numeric: true },
      { header: "Name", value: (r) => `${r.itemName}${r.uom ? ` (${r.uom})` : ""}`, width: 32 },
      { header: "Rate", value: (r) => r.rate, numeric: true },
      ...days.map((d) => ({
        header: label(d),
        value: (r: BranchwiseDeliveryRow) => r.qtyByDate[d] ?? 0,
        numeric: true,
      })),
      { header: "TotalQty", value: (r) => r.totalQty, numeric: true },
      { header: "Amount", value: (r) => r.amount, numeric: true },
    ];
  }, [report]);

  const subtitle = useMemo(
    () =>
      [report?.issueBranch.name, report?.receiveBranch.name, periodLabel(fromDate, toDate)]
        .filter(Boolean)
        .join(" · "),
    [report, fromDate, toDate],
  );

  return (
    <AppLayout>
      <PageHeader title="Branchwise Delivery Report" subtitle="Item deliveries out of a branch, day by day" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Issue Branch"
          value={issueBranchId}
          onChange={(e) => setIssueBranchId(e.target.value)}
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-48"
        />
        <Select
          label="Receive Branch"
          value={receiveBranchId}
          onChange={(e) => setReceiveBranchId(e.target.value)}
          placeholder="All Branch"
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-48"
        />
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>}
        {/* Print renders the bespoke landscape sheet; PDF/Excel export the table. */}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={report?.items ?? []}
          columns={exportColumns}
          meta={{ title: "Branchwise Delivery Report", subtitle }}
        />
      </div>

      {report && (
        <>
          <style>{`
            @media print {
              @page { size: A4 landscape; margin: 8mm; }
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

function Report({ data }: { data: BranchwiseDeliveryReport }) {
  const { company, issueBranch, receiveBranch, days, items, totals } = data;
  const label = dayHeader(days);

  return (
    <div id="report" className="bg-white text-black text-[10px] border border-sage-400 p-4 overflow-x-auto">
      {/* ── Letterhead: the company, then the branch the goods went out from ── */}
      <div className="text-center mb-3">
        <div className="font-extrabold text-[16px] italic">{company.name}</div>
        <div className="text-[10px] italic">{issueBranch.address || company.address}</div>
      </div>

      <div className="border-t border-black mb-3" />

      {/* The title names the receiving branch — who the delivery was for. */}
      <div className="text-center font-bold underline text-[13px] mb-3">
        {receiveBranch.name ? `${receiveBranch.name}. ` : ""}Branch Wise Delivery {periodLabel(data.fromDate, data.toDate)}
      </div>

      <table className="w-full border-collapse border border-black text-right whitespace-nowrap">
        <thead>
          <tr className="border-b border-black font-bold text-center">
            <th className="border border-gray-400 px-1 py-0.5">SL</th>
            <th className="border border-gray-400 px-1 py-0.5 text-left">Name</th>
            <th className="border border-gray-400 px-1 py-0.5">Rate</th>
            {days.map((d) => (
              <th key={d} className="border border-gray-400 px-1 py-0.5">{label(d)}</th>
            ))}
            <th className="border border-gray-400 px-1 py-0.5">TotalQty</th>
            <th className="border border-gray-400 px-1 py-0.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={`${r.itemCode}-${r.sl}`} className="border-b border-sage-300">
              <td className="border border-sage-300 px-1 text-center">{r.sl}</td>
              <td className="border border-sage-300 px-1 text-left">
                {r.itemName} {r.uom && <span className="text-gray-500">({r.uom})</span>}
              </td>
              <td className="border border-sage-300 px-1">{amt(r.rate)}</td>
              {days.map((d) => (
                <td key={d} className="border border-sage-300 px-1">{q(r.qtyByDate[d])}</td>
              ))}
              <td className="border border-sage-300 px-1 font-semibold">{q(r.totalQty)}</td>
              <td className="border border-sage-300 px-1 font-semibold">{amt(r.amount)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="border border-sage-300 px-2 py-3 text-center text-gray-500" colSpan={days.length + 5}>
                No deliveries found for the selected branches and date range.
              </td>
            </tr>
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td className="border border-sage-400 px-1" colSpan={3}>Total ({items.length} items)</td>
              {days.map((d) => (
                <td key={d} className="border border-sage-400 px-1">{q(totals.qtyByDate[d])}</td>
              ))}
              <td className="border border-sage-400 px-1">{q(totals.totalQty)}</td>
              <td className="border border-sage-400 px-1">{amt(totals.amount)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* ── Signatures ──
          Directly under the last row of data, with 2in of clear signing space
          above the rules. Kept whole so the block never splits across sheets. */}
      <div className="flex justify-between mt-[2in] break-inside-avoid text-[10px] text-center">
        {["Prepared By", "Checked By", "Accountant", "Authorised Sign"].map((l) => (
          <div key={l} className="border-t border-black px-6 pt-1">{l}</div>
        ))}
      </div>
    </div>
  );
}
