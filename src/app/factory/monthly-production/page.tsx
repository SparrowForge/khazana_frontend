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
  fetchMonthlyProduction,
  type MonthlyProductionReport,
  type MonthlyProductionRow,
} from "./server";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import {
  isWholeMonth, monthName, spanLabel, dayHeader, q, amt, getDefaultMonth,
} from "@/lib/reports/dayPivot";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import type { ExportColumn } from "@/lib/export/reportExport";

/** The legacy sheet is headed "On August 2026" when the range covers exactly one
 *  calendar month, which is how the factory normally runs it. Any other range
 *  prints as a span so the heading never misrepresents the query. */
const periodLabel = (fromDate: string, toDate: string) =>
  isWholeMonth(fromDate, toDate) ? `On ${monthName(fromDate)}` : spanLabel(fromDate, toDate);

/** A block's subtotal caption. Named by its unit so a reader can never take a
 *  KG figure for a Pcs one — the whole reason the sheet is split at all. */
const groupLabel = (uom: string) => (uom.trim() ? `Total (${uom})` : "Total (no unit)");

export default function MonthlyProductionReportPage() {
  const defaults = getDefaultMonth();
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Producing branch. Seeded with the branch the user logged in at — the
  // factory — and blank means every branch ("All Branch").
  const [branchId, setBranchId] = useState("");
  const [report, setReport] = useState<MonthlyProductionReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches({ page: 1, limit: 100 })
      // Already in Branch.sortingNo order — /admin/branches sorts by it.
      .then(({ items }) => setBranches(items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionBranchId) setBranchId((b) => b || sessionBranchId);
  }, [sessionBranchId]);

  const runReport = () => {
    setLoading(true);
    fetchMonthlyProduction(fromDate, toDate, branchId || undefined)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        toast.error(getErrorMessage(err, "Failed to load the report"));
      })
      .finally(() => setLoading(false));
  };

  /** Every block's rows, one flat list. PDF/Excel have no notion of the printed
   *  blocks, so the UOM travels as its own column — a reader can still total
   *  per unit there, and never sums two units by accident. */
  const exportRows = useMemo(
    () => (report?.groups ?? []).flatMap((g) => g.items),
    [report],
  );

  // Day columns are only known once the report has run, so the export spec is
  // built from the returned days rather than declared up front.
  const exportColumns = useMemo<ExportColumn<MonthlyProductionRow>[]>(() => {
    const days = report?.days ?? [];
    const label = dayHeader(days);
    return [
      { header: "SL", value: (r) => r.sl, numeric: true },
      { header: "Name", value: (r) => r.itemName, width: 32 },
      { header: "UOM", value: (r) => r.uom, width: 10 },
      { header: "Rate (Incl. VAT)", value: (r) => r.rate, numeric: true },
      // Kept numeric above (so Excel can still compute with it) and qualified
      // here, rather than exporting a "~1866.67" string nothing can sum.
      { header: "Rate Basis", value: (r) => (r.rateIsAverage ? "Average" : "Exact"), width: 11 },
      ...days.map((d) => ({
        header: label(d),
        value: (r: MonthlyProductionRow) => r.qtyByDate[d] ?? 0,
        numeric: true,
      })),
      { header: "TotalQty", value: (r) => r.totalQty, numeric: true },
      { header: "Amount (Incl. VAT)", value: (r) => r.amount, numeric: true },
    ];
  }, [report]);

  const subtitle = useMemo(
    () => [report?.branch.name, periodLabel(fromDate, toDate)].filter(Boolean).join(" · "),
    [report, fromDate, toDate],
  );

  return (
    <AppLayout>
      <PageHeader
        title="Monthly Production Report"
        subtitle="Items produced day by day, totalled per unit of measure — rates and amounts include VAT"
      />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Branch Name"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          placeholder="All Branch"
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-56"
        />
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>}
        {/* Print renders the bespoke landscape sheet; PDF/Excel export the table. */}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={exportRows}
          columns={exportColumns}
          meta={{ title: "Monthly Production Report", subtitle }}
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

function Report({ data }: { data: MonthlyProductionReport }) {
  const { company, branch, days, groups, totals } = data;
  const label = dayHeader(days);
  /** SL + Name + Rate, then a column per day, then TotalQty + Amount. */
  const colCount = 3 + days.length + 2;

  // The header is repeated above every block, exactly as the legacy sheet does
  // — a block can start most of a page down, and unlabelled day columns there
  // are unreadable.
  const headerCells = (
    <>
      <th className="border border-gray-400 px-1 py-0.5">SL</th>
      <th className="border border-gray-400 px-1 py-0.5 text-left">Name</th>
      {/* Both money columns are VAT-INCLUSIVE — `Production.rate` is stored that
          way and nothing is grossed up on the way out. Said on the sheet because
          the legacy pad's "Rate" was the EX-VAT list price (1636.36 = 1800/1.1),
          so an unlabelled column invites exactly the wrong comparison. */}
      <th className="border border-gray-400 px-1 py-0.5">
        Rate<div className="font-normal text-[8px] text-gray-600">Incl. VAT</div>
      </th>
      {days.map((d) => (
        <th key={d} className="border border-gray-400 px-1 py-0.5">{label(d)}</th>
      ))}
      <th className="border border-gray-400 px-1 py-0.5">TotalQty</th>
      <th className="border border-gray-400 px-1 py-0.5">
        Amount<div className="font-normal text-[8px] text-gray-600">Incl. VAT</div>
      </th>
    </>
  );

  return (
    <div id="report" className="bg-white text-black text-[10px] border border-sage-400 p-4 overflow-x-auto">
      {/* ── Letterhead: the company, then the branch that produced ── */}
      <div className="text-center mb-3">
        <div className="font-extrabold text-[16px] italic">{company.name}</div>
        <div className="text-[10px] italic">{branch.address || company.address}</div>
      </div>

      <div className="border-t border-black mb-3" />

      <div className="text-center font-bold underline text-[13px] mb-3">
        {branch.name && branch.id ? `${branch.name}. ` : ""}
        Monthly Final Production Report {periodLabel(data.fromDate, data.toDate)}
      </div>

      <table className="w-full border-collapse border border-black text-right whitespace-nowrap">
        <thead>
          <tr className="border-b border-black font-bold text-center">{headerCells}</tr>
        </thead>
        {groups.map((g, gi) => (
          <tbody key={g.uom || `_${gi}`}>
            {/* Every block after the first reprints the column header. */}
            {gi > 0 && (
              <tr className="border-y border-black font-bold text-center">{headerCells}</tr>
            )}
            {g.items.map((r) => (
              <tr key={r.itemCode || `${r.sl}`} className="border-b border-sage-300">
                <td className="border border-sage-300 px-1 text-center">{r.sl}</td>
                <td className="border border-sage-300 px-1 text-left">
                  {r.itemName} {r.uom && <span className="text-gray-500">({r.uom})</span>}
                </td>
                {/* "~" marks a weighted average — the item was produced at
                    more than one rate, so Rate x TotalQty need not land exactly
                    on Amount. Amount is the money; Rate is the derived figure. */}
                <td className="border border-sage-300 px-1">
                  {r.rateIsAverage && <span className="text-gray-500">~</span>}{amt(r.rate)}
                </td>
                {days.map((d) => (
                  <td key={d} className="border border-sage-300 px-1">{q(r.qtyByDate[d])}</td>
                ))}
                <td className="border border-sage-300 px-1 font-semibold">{q(r.totalQty)}</td>
                <td className="border border-sage-300 px-1 font-semibold">{amt(r.amount)}</td>
              </tr>
            ))}
            {/* ── The block subtotal. Quantities are only ever added WITHIN a
                unit of measure, so this — not the grand total — is the qty
                figure the factory reads off the sheet. ── */}
            <tr className="border-y border-black font-bold bg-sage-50">
              <td className="border border-sage-400 px-1 text-left" colSpan={3}>
                {groupLabel(g.uom)} — {g.items.length} item{g.items.length === 1 ? "" : "s"}
              </td>
              {days.map((d) => (
                <td key={d} className="border border-sage-400 px-1">{q(g.totals.qtyByDate[d])}</td>
              ))}
              <td className="border border-sage-400 px-1">{q(g.totals.totalQty)}</td>
              <td className="border border-sage-400 px-1">{amt(g.totals.amount)}</td>
            </tr>
          </tbody>
        ))}
        {groups.length === 0 && (
          <tbody>
            <tr>
              <td className="border border-sage-300 px-2 py-3 text-center text-gray-500" colSpan={colCount}>
                No production found for the selected branch and date range.
              </td>
            </tr>
          </tbody>
        )}
        {groups.length > 0 && (
          <tfoot>
            {/* ── Grand total. The Amount is a true total; the quantity adds
                different units together, so it is captioned as a mixed figure
                rather than presented as a quantity anyone should act on. ── */}
            <tr className="border-t-2 border-black font-bold">
              <td className="border border-sage-400 px-1 text-left" colSpan={3}>
                Grand Total{groups.length > 1 ? " (qty is a mixed-unit sum — read the per-unit totals above)" : ""}
              </td>
              {days.map((d) => (
                <td key={d} className="border border-sage-400 px-1">{q(totals.qtyByDate[d])}</td>
              ))}
              <td className="border border-sage-400 px-1">{q(totals.totalQty)}</td>
              <td className="border border-sage-400 px-1">{amt(totals.amount)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Only shown when a row actually needs it, so the sheet stays clean. */}
      {groups.some((g) => g.items.some((i) => i.rateIsAverage)) && (
        <div className="mt-2 text-[9px] italic text-gray-600">
          ~ Rate is a weighted average — the item was produced at more than one rate in this period,
          so Rate × TotalQty may differ from Amount by a paisa. Amount is the actual value produced.
        </div>
      )}

      {/* ── Signatures ──
          Directly under the last row of data, with 2in of clear signing space
          above the rules. Kept whole so the block never splits across sheets. */}
      <div className="flex items-end justify-between mt-[2in] break-inside-avoid text-[10px] text-center">
        {/* The revision marker the printed pad carries in its bottom-left. */}
        <div className="text-left font-semibold">REV#0</div>
        {["Accountant", "Manager Operation", "Director"].map((l) => (
          <div key={l} className="border-t border-black px-6 pt-1">{l}</div>
        ))}
      </div>
    </div>
  );
}
