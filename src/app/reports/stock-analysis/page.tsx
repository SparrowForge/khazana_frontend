"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import { fetchStockAnalysis, type StockAnalysisReport, type StockAnalysisRow } from "./server";
import { fetchMyBranches, type Branch } from "@/app/admin/branches/server";
import { formatCurrency} from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";

const formatDate = (dateString : string | Date) => {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  
  // Extract components using UTC to prevent timezone/hydration shifts
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  
  return `${day}-${month}-${year}`; // Returns "30-Jun-2026"
};

// Quantities: render a dash ONLY when the value is exactly 0 (to 2dp). A negative
// balance is a real deficit and MUST print with its sign (e.g. -1.00) — never
// blanked or absolute-valued. We round to 2dp first so float noise like
// -0.000001 reads as 0 ("-"), while a genuine -1.00 stays "-1.00".
const q = (n: number) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : v.toFixed(2);
};
const amt = (n: number) => formatCurrency(n ?? 0);
const pcs = (n: number) => String(Math.round(n ?? 0));

export default function StockAnalysisPage() {
  const today = new Date().toISOString().split("T")[0];
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  // Report can target any branch (sales are recorded per-branch); default to the
  // logged-in session branch. Lets an admin view e.g. Factory's stock from a
  // Gulshan session — the cause of "sales exist but the report shows zero".
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  // When true, the report aggregates every branch together (no branch filter).
  const [allBranches, setAllBranches] = useState(false);
  const [report, setReport] = useState<StockAnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);

  // Only the branches this user is mapped to — the picker must never offer a
  // branch whose figures they may not read. The report endpoint scopes on the
  // same set, so "All Branches" means all of THEIR branches.
  useEffect(() => {
    fetchMyBranches()
      .then(setBranches)
      .catch(() => {});
  }, []);

  // Default the selected branch to the session branch once known.
  // Default to the session branch, falling back to the first accessible one for
  // a session whose login branch is no longer mapped to the user.
  useEffect(() => {
    if (!branches.length) return;
    setBranchId((current) => {
      if (current && branches.some((b) => String(b.id) === current)) return current;
      if (sessionBranchId && branches.some((b) => String(b.id) === sessionBranchId)) return sessionBranchId;
      return String(branches[0].id);
    });
  }, [branches, sessionBranchId]);

  const runReport = () => {
    if (!allBranches && !branchId) return;
    setLoading(true);
    fetchStockAnalysis(fromDate, toDate, allBranches ? undefined : branchId)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  return (
    <AppLayout>
      <PageHeader title="Stock Analysis Report" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Branch"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-48"
          disabled={allBranches}
        />
        {/* Nothing to combine when the user only has the one branch, and the
            checkbox would read as a promise of data they cannot see. */}
        {branches.length > 1 && (
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 select-none">
            <input
              type="checkbox"
              checked={allBranches}
              onChange={(e) => setAllBranches(e.target.checked)}
              className="h-4 w-4 rounded border-sage-400 text-primary-800 focus:ring-primary-800"
            />
            All Branches
          </label>
        )}
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>}
        {/* Print above renders the bespoke landscape sheet (with its summary
            blocks); PDF/Excel export the item table. */}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={report?.items ?? []}
          columns={exportColumns}
          meta={{
            title: "Stock Analysis Report",
            subtitle: [
              allBranches ? "All Branches" : report?.branch.name,
              `${formatDate(fromDate)} — ${formatDate(toDate)}`,
            ]
              .filter(Boolean)
              .join(" · "),
          }}
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

const COLS: { key: keyof StockAnalysisRow; label: string; amount?: boolean }[] = [
  { key: "rate", label: "Rate", amount: true },
  { key: "openStock", label: "Open Stock" },
  { key: "production", label: "Production" },
  { key: "gReceive", label: "G. Receive" },
  { key: "totalStock", label: "Total Stock" },
  { key: "salesQty", label: "Sales/Qty" },
  { key: "salesAmt", label: "Sales Amt", amount: true },
  { key: "assorted", label: "Assorted" },
  { key: "nc", label: "NC" },
  { key: "reject", label: "Reject" },
  { key: "issueQty", label: "Issue Qty" },
  { key: "short", label: "Short" },
  { key: "excess", label: "Excess" },
  { key: "closing", label: "Closing St." },
];

// Derived from COLS so the export can't drift from the on-screen table. Every
// COLS entry is numeric (quantities or money); the identity columns lead.
const exportColumns: ExportColumn<StockAnalysisRow>[] = [
  { header: "SL", value: (r) => r.sl, numeric: true },
  { header: "Item Code", value: (r) => r.itemCode },
  { header: "Item Name", value: (r) => r.itemName, width: 30 },
  { header: "UOM", value: (r) => r.uom },
  ...COLS.map((c) => ({
    header: c.label,
    value: (r: StockAnalysisRow) => Number(r[c.key] ?? 0),
    numeric: true,
  })),
];

function Report({ data }: { data: StockAnalysisReport }) {
  const { branch, items, totals, summary: s, categories: c } = data;

  return (
    <div id="report" className="bg-white text-black text-[11px] border border-sage-400 p-4">
      {/* ── Header ── */}
      <div className="text-center mb-3">
        <div className="font-extrabold text-[16px] italic">Khazana Mithai</div>
        <div className="font-semibold">{branch.name}</div>
        {branch.address && <div className="text-[10px]">{branch.address}</div>}
        <div className="mt-1">
          <span className="font-bold italic">Stock Analysis: </span>
          <span className="font-semibold">
            {data.fromDate === data.toDate
              ? formatDate(data.fromDate)
              : `${formatDate(data.fromDate)} — ${formatDate(data.toDate)}`}
          </span>
        </div>      
      </div>

      {/* ── Item table ── */}
      <table className="w-full border-collapse border border-black text-right">
        <thead>
          <tr className="border-b border-black font-bold text-center">
            <th className="border border-gray-400 px-1 py-0.5">SL</th>
            <th className="border border-gray-400 px-1 py-0.5 text-left">Item Name</th>
            {COLS.map((col) => (
              <th key={col.key} className="border border-gray-400 px-1 py-0.5">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.itemCode} className="border-b border-sage-300">
              <td className="border border-sage-300 px-1 text-center">{r.sl}</td>
              <td className="border border-sage-300 px-1 text-left whitespace-nowrap">
                {r.itemName} {r.uom && <span className="text-gray-500">({r.uom})</span>}
              </td>
              {COLS.map((col) => (
                <td key={col.key} className="border border-sage-300 px-1">
                  {col.amount ? amt(r[col.key] as number) : q(r[col.key] as number)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td className="border border-sage-400 px-1" colSpan={2}></td>
            <td className="border border-sage-400 px-1"></td>
            <td className="border border-sage-400 px-1">{q(totals.openStock)}</td>
            <td className="border border-sage-400 px-1">{q(totals.production)}</td>
            <td className="border border-sage-400 px-1">{q(totals.gReceive)}</td>
            <td className="border border-sage-400 px-1">{q(totals.totalStock)}</td>
            <td className="border border-sage-400 px-1">{q(totals.salesQty)}</td>
            <td className="border border-sage-400 px-1">{amt(totals.salesAmt)}</td>
            <td className="border border-sage-400 px-1">{q(totals.assorted)}</td>
            <td className="border border-sage-400 px-1">{q(totals.nc)}</td>
            <td className="border border-sage-400 px-1">{q(totals.reject)}</td>
            <td className="border border-sage-400 px-1">{q(totals.issueQty)}</td>
            <td className="border border-sage-400 px-1">{q(totals.short)}</td>
            <td className="border border-sage-400 px-1">{q(totals.excess)}</td>
            <td className="border border-sage-400 px-1">{q(totals.closing)}</td>
          </tr>
        </tfoot>
      </table>

      {/* ── Footer summary ── */}
      <div className="flex flex-wrap justify-between gap-6 mt-5">
        {/* Sales totals */}
        <table className="border-collapse min-w-[240px] self-start">
          <tbody>
            {[
              ["Cash Sale", s.cashSale],
              ["Card Sale", s.cardSale],
              ["Credit Sale", s.creditSale],
            ].map(([label, v]) => (
              <tr key={label as string}>
                <td className="font-bold py-0.5 pr-8">{label as string}</td>
                <td className="text-right">{amt(v as number)}</td>
              </tr>
            ))}
            <tr className="border-t border-black">
              <td className="font-bold py-0.5 pr-8">Total Sale</td>
              <td className="text-right font-bold">{amt(s.totalSale)}</td>
            </tr>
            <tr>
              <td className="font-bold py-0.5 pr-8">NC Sale</td>
              <td className="text-right">{amt(s.ncSale)}</td>
            </tr>
            <tr className="border-b border-black">
              <td className="font-bold py-0.5 pr-8">Discount</td>
              <td className="text-right">{amt(s.discount)}</td>
            </tr>
            <tr>
              <td className="font-extrabold py-0.5 pr-8">Grand Total</td>
              <td className="text-right font-extrabold">{amt(s.grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* Category qty (Kg/Pcs/Amount) */}
        <table className="border-collapse border border-black self-start">
          <thead>
            <tr className="border-b border-black text-center font-bold">
              <th className="px-3 py-0.5"></th>
              <th className="px-3 py-0.5 border-l border-gray-400">Kg</th>
              <th className="px-3 py-0.5">Pcs</th>
              <th className="px-3 py-0.5 border-l border-gray-400">Amount</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Regular Sale", c.regular],
              ["Assorted Sale", c.assorted],
              ["Issue Sale", c.issue],
              ["Credit Sale", c.credit],
            ].map(([label, cat]) => {
              const r = cat as StockAnalysisReport["categories"]["regular"];
              return (
                <tr key={label as string} className="border-b border-sage-300">
                  <td className="font-bold px-3 py-0.5">{label as string}</td>
                  <td className="text-right px-3 border-l border-sage-400">{r.kg.toFixed(2)}</td>
                  <td className="text-right px-3">{pcs(r.pcs)}</td>
                  <td className="text-right px-3 border-l border-sage-400">{amt(r.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Signatures ──
          Directly under the last row of data, with 2in of clear signing space
          above the rules. Kept whole so the block never splits across sheets. */}
      <div className="flex justify-between mt-[2in] break-inside-avoid text-[10px] text-center">
        {["Prepared By", "Checked By", "Accountant", "Authorised Sign"].map((label) => (
          <div key={label} className="border-t border-black px-6 pt-1">{label}</div>
        ))}
      </div>
    </div>
  );
}
