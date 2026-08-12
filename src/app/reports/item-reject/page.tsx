"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import { fetchItemRejectReport, type ItemRejectReport, type ItemRejectRow } from "./server";
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

// Quantities: dash only when exactly 0 (to 2dp) — see stock-analysis for why a
// genuine negative must keep its sign rather than being blanked.
const q = (n: number) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : v.toFixed(2);
};
const amt = (n: number) => formatCurrency(n ?? 0);

/** Column header for a date: bare day number when the whole range sits inside
 *  one calendar month (matches the legacy monthly sheet), else "DD-Mon" so two
 *  different months don't both print as e.g. "1". */
const dayLabel = (dateStr: string, singleMonth: boolean) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = String(d.getUTCDate());
  if (singleMonth) return day;
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day}-${mon}`;
};

export default function ItemRejectReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Reject Branch — defaults to the logged-in session branch; user may switch it.
  const [branchId, setBranchId] = useState("");
  const [report, setReport] = useState<ItemRejectReport | null>(null);
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
    fetchItemRejectReport(fromDate, toDate, branchId || undefined)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  const singleMonth = useMemo(() => {
    if (!report || report.dates.length === 0) return true;
    const first = report.dates[0].slice(0, 7);
    return report.dates.every((d) => d.slice(0, 7) === first);
  }, [report]);

  const exportColumns: ExportColumn<ItemRejectRow>[] = useMemo(() => {
    const dates = report?.dates ?? [];
    return [
      { header: "SL", value: (r) => r.sl, numeric: true },
      { header: "Item Code", value: (r) => r.itemCode },
      { header: "Item Name", value: (r) => r.itemName, width: 28 },
      { header: "UOM", value: (r) => r.uom },
      { header: "Price", value: (r) => r.price, numeric: true },
      ...dates.map((d) => ({
        header: dayLabel(d, singleMonth),
        value: (r: ItemRejectRow) => r.qtyByDate[d] ?? 0,
        numeric: true,
      })),
      { header: "Total Qty", value: (r) => r.totalQty, numeric: true },
      { header: "Amount", value: (r) => r.amount, numeric: true },
    ];
  }, [report, singleMonth]);

  return (
    <AppLayout>
      <PageHeader title="Item Reject Report" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-gray-200">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Reject Branch"
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
          meta={{
            title: "Item Reject Report",
            subtitle: [report?.branch.name, `${formatDate(fromDate)} — ${formatDate(toDate)}`]
              .filter(Boolean)
              .join(" · "),
          }}
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
          <Report data={report} singleMonth={singleMonth} />
        </>
      )}
    </AppLayout>
  );
}

function Report({ data, singleMonth }: { data: ItemRejectReport; singleMonth: boolean }) {
  const { branch, items, dates, totals } = data;

  return (
    <div id="report" className="bg-white text-black text-[11px] border border-gray-300 p-4 overflow-x-auto">
      <div className="text-center mb-3">
        <div className="font-extrabold text-[16px] italic">Khazana Mithai Limited</div>
        <div className="font-semibold">Item Reject Report</div>
        <div className="text-[10px]">{branch.name}</div>
        <div className="mt-1 font-semibold">
          {data.fromDate === data.toDate ? formatDate(data.fromDate) : `${formatDate(data.fromDate)} — ${formatDate(data.toDate)}`}
        </div>
      </div>

      <table className="w-full border-collapse border border-black text-right">
        <thead>
          <tr className="border-b border-black font-bold text-center">
            <th className="border border-gray-400 px-1 py-0.5">SL</th>
            <th className="border border-gray-400 px-1 py-0.5 text-left">Item Name</th>
            <th className="border border-gray-400 px-1 py-0.5">Price</th>
            {dates.map((d) => (
              <th key={d} className="border border-gray-400 px-1 py-0.5">{dayLabel(d, singleMonth)}</th>
            ))}
            <th className="border border-gray-400 px-1 py-0.5">Total Qty</th>
            <th className="border border-gray-400 px-1 py-0.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.itemCode} className="border-b border-gray-200">
              <td className="border border-gray-200 px-1 text-center">{r.sl}</td>
              <td className="border border-gray-200 px-1 text-left whitespace-nowrap">
                {r.itemName} {r.uom && <span className="text-gray-500">({r.uom})</span>}
              </td>
              <td className="border border-gray-200 px-1">{amt(r.price)}</td>
              {dates.map((d) => (
                <td key={d} className="border border-gray-200 px-1">{q(r.qtyByDate[d] ?? 0)}</td>
              ))}
              <td className="border border-gray-200 px-1 font-semibold">{q(r.totalQty)}</td>
              <td className="border border-gray-200 px-1 font-semibold">{amt(r.amount)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="border border-gray-200 px-2 py-3 text-center text-gray-500" colSpan={dates.length + 4}>
                No rejects found for the selected filters.
              </td>
            </tr>
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td className="border border-gray-300 px-1" colSpan={2}></td>
              <td className="border border-gray-300 px-1"></td>
              {dates.map((d) => (
                <td key={d} className="border border-gray-300 px-1">{q(totals.byDate[d] ?? 0)}</td>
              ))}
              <td className="border border-gray-300 px-1">{q(totals.totalQty)}</td>
              <td className="border border-gray-300 px-1">{amt(totals.amount)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
