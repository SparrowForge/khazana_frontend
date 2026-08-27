"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import { fetchPacketStock, type PacketStockReport, type PacketStockRow } from "./server";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import type { ExportColumn } from "@/lib/export/reportExport";

const formatDay = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day}-${month}-${date.getUTCFullYear()}`;
};

/** Quantities print as a dash only when exactly 0 — a genuine negative keeps
 *  its sign, because on this sheet it means the register is out of step and
 *  hiding it would hide the problem. */
const q = (n: number) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : v.toFixed(2);
};

const exportColumns: ExportColumn<PacketStockRow>[] = [
  { header: "Code", value: (r) => r.code },
  { header: "Packet Name", value: (r) => r.name ?? "-", width: 28 },
  { header: "UOM", value: (r) => r.uom ?? "-" },
  { header: "Opening", value: (r) => r.opening, numeric: true },
  { header: "Received", value: (r) => r.received, numeric: true },
  { header: "Issued", value: (r) => r.issued, numeric: true },
  { header: "Balance", value: (r) => r.balance, numeric: true },
];

/** Default window: this calendar month to date. Everything before the 1st
 *  becomes the opening balance, which is what makes the column meaningful. */
const defaultRange = () => {
  const now = new Date();
  return {
    fromDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    toDate: now.toISOString().split("T")[0],
  };
};

export default function PacketStockPage() {
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const initial = defaultRange();

  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [toDate, setToDate] = useState(initial.toDate);
  const [branchId, setBranchId] = useState("");
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [report, setReport] = useState<PacketStockReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches({ page: 1, limit: 100 })
      .then(({ items }) => setBranches(items))
      .catch(() => {});
  }, []);

  // Default the branch filter to the session branch; the user can widen it to
  // any branch their permissions already allow (the API scopes it either way).
  useEffect(() => {
    if (sessionBranchId) setBranchId((b) => b || sessionBranchId);
  }, [sessionBranchId]);

  const runReport = useCallback(() => {
    setLoading(true);
    fetchPacketStock({ fromDate, toDate, branchId: branchId || undefined, includeEmpty })
      .then(setReport)
      .catch((err) => {
        setReport(null);
        toast.error(getErrorMessage(err, "Failed to load packet stock"));
      })
      .finally(() => setLoading(false));
  }, [fromDate, toDate, branchId, includeEmpty]);

  // First load only, once the session branch is known, so the page opens with
  // data instead of an empty sheet waiting on a click. Guarded rather than
  // keyed on the filters: `runReport` changes identity with every filter, and
  // re-running on that would fire a request per keystroke in a date field.
  const [autoRan, setAutoRan] = useState(false);
  useEffect(() => {
    if (!branchId || autoRan) return;
    setAutoRan(true);
    runReport();
  }, [branchId, autoRan, runReport]);

  const branchLabel = useMemo(
    () => branches.find((b) => String(b.id) === branchId)?.branchName ?? "All branches",
    [branches, branchId],
  );

  const rows = report?.items ?? [];
  const totals = report?.totals;

  return (
    <AppLayout>
      <PageHeader title="Packet Stock" subtitle="Opening, movement and closing balance per packet" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Branch"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          placeholder="All branches"
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-52"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-2.5">
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(e) => setIncludeEmpty(e.target.checked)}
            className="rounded border-sage-400 text-primary-800 focus:ring-primary-800"
          />
          Show packets with no movement
        </label>
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={rows}
          columns={exportColumns}
          meta={{
            title: "Packet Stock",
            subtitle: [branchLabel, `${formatDay(fromDate)} — ${formatDay(toDate)}`].filter(Boolean).join(" · "),
            forcePortrait: true,
          }}
        />
      </div>

      {report && (
        <>
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 10mm; }
              body * { visibility: hidden !important; }
              #report, #report * { visibility: visible !important; }
              #report { position: absolute; top: 0; left: 0; width: 100%; }
              .no-print { display: none !important; }
            }
          `}</style>

          <div id="report" className="bg-white text-black text-[11px] border border-sage-400 p-4 overflow-x-auto">
            <div className="text-center mb-3">
              <div className="font-extrabold text-[16px] italic">Khazana Mithai Limited</div>
              <div className="font-semibold">Packet Stock</div>
              <div className="text-[10px]">{branchLabel}</div>
              <div className="mt-1 font-semibold">
                {fromDate === toDate ? formatDay(fromDate) : `${formatDay(fromDate)} — ${formatDay(toDate)}`}
              </div>
            </div>

            <table className="w-full border-collapse border border-black text-right">
              <thead>
                <tr className="border-b border-black font-bold text-center">
                  <th className="border border-gray-400 px-1 py-0.5">SL</th>
                  <th className="border border-gray-400 px-1 py-0.5">Code</th>
                  <th className="border border-gray-400 px-1 py-0.5 text-left">Packet Name</th>
                  <th className="border border-gray-400 px-1 py-0.5">UOM</th>
                  <th className="border border-gray-400 px-1 py-0.5">Opening</th>
                  <th className="border border-gray-400 px-1 py-0.5">Received</th>
                  <th className="border border-gray-400 px-1 py-0.5">Issued</th>
                  <th className="border border-gray-400 px-1 py-0.5">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.code} className="border-b border-sage-300">
                    <td className="border border-sage-300 px-1 text-center">{i + 1}</td>
                    <td className="border border-sage-300 px-1 text-center whitespace-nowrap">{r.code}</td>
                    <td className="border border-sage-300 px-1 text-left">{r.name || "-"}</td>
                    <td className="border border-sage-300 px-1 text-center">{r.uom || "-"}</td>
                    <td className="border border-sage-300 px-1">{q(r.opening)}</td>
                    <td className="border border-sage-300 px-1">{q(r.received)}</td>
                    <td className="border border-sage-300 px-1">{q(r.issued)}</td>
                    <td className="border border-sage-300 px-1 font-semibold">{q(r.balance)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="border border-sage-300 px-2 py-3 text-center text-gray-500" colSpan={8}>
                      {loading ? "Loading..." : "No packet movement for the selected filters."}
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && totals && (
                <tfoot>
                  <tr className="border-t-2 border-black font-bold">
                    <td className="border border-sage-400 px-1" colSpan={4}>Total</td>
                    <td className="border border-sage-400 px-1">{q(totals.opening)}</td>
                    <td className="border border-sage-400 px-1">{q(totals.received)}</td>
                    <td className="border border-sage-400 px-1">{q(totals.issued)}</td>
                    <td className="border border-sage-400 px-1">{q(totals.balance)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
