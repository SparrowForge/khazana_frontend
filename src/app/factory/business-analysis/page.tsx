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
  fetchBusinessAnalysis,
  type BusinessAnalysisReport,
  type BusinessAnalysisRow,
} from "./server";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import { formatDate, getDefaultMonth } from "@/lib/reports/dayPivot";
import { formatCurrency } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import type { ExportColumn } from "@/lib/export/reportExport";

/** The sheet prints 0.00 rather than a dash: it is a balance statement, and a
 *  blank in a column that has to reconcile reads as missing data. */
const n2 = (v: number | undefined) => formatCurrency(Number(v ?? 0));

export default function BusinessAnalysisReportPage() {
  const defaults = getDefaultMonth();
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [branches, setBranches] = useState<Branch[]>([]);
  // The branch the statement is for. No "All Branch": a stock roll-forward is
  // per branch, and a combined figure would net transfers away to nothing.
  const [branchId, setBranchId] = useState("");
  const [report, setReport] = useState<BusinessAnalysisReport | null>(null);
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
    fetchBusinessAnalysis(fromDate, toDate, branchId || undefined)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        toast.error(getErrorMessage(err, "Failed to load the report"));
      })
      .finally(() => setLoading(false));
  };

  /** Both blocks and their totals, one flat list, with a Section column so the
   *  spreadsheet still shows which side of the statement a row sits on. */
  const exportRows = useMemo(() => {
    if (!report) return [];
    const { inflow, inflowTotal, outflow, outflowTotal } = report.finishGoods;
    return [
      ...inflow.map((r) => ({ section: "In", ...r })),
      { section: "In", ...inflowTotal },
      ...outflow.map((r) => ({ section: "Out", ...r })),
      { section: "Out", ...outflowTotal },
    ];
  }, [report]);

  const exportColumns = useMemo<ExportColumn<BusinessAnalysisRow & { section: string }>[]>(() => {
    const uoms = report?.uoms ?? [];
    return [
      { header: "Section", value: (r) => r.section, width: 8 },
      { header: "Particulars", value: (r) => r.label, width: 30 },
      ...uoms.map((u) => ({
        header: u,
        value: (r: BusinessAnalysisRow & { section: string }) => r.qty[u] ?? 0,
        numeric: true,
      })),
      { header: "Amount", value: (r) => r.amount, numeric: true },
    ];
  }, [report]);

  const subtitle = useMemo(
    () => [report?.branch.name, `${formatDate(fromDate)} → ${formatDate(toDate)}`].filter(Boolean).join(" · "),
    [report, fromDate, toDate],
  );

  return (
    <AppLayout>
      <PageHeader
        title="Business Analysis Report"
        subtitle="Stock statement — what came in, what went out, and what is left"
      />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Branch Name"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-56"
        />
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={exportRows}
          columns={exportColumns}
          meta={{ title: "Business Analysis Report", subtitle, forcePortrait: true }}
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
          <Report data={report} />
        </>
      )}
    </AppLayout>
  );
}

/** The rotated block caption down the left edge of each table, as the pad prints
 *  it ("Main Store", "Finish Goods"). It spans the whole block, so it is written
 *  once in the header row with a rowSpan rather than per row — a second cell in
 *  that column would push every following row one column out of step. */
function SideLabel({ text, rowSpan }: { text: string; rowSpan: number }) {
  return (
    <td className="border border-black w-8 p-0 align-middle" rowSpan={rowSpan}>
      <div
        className="mx-auto font-bold text-[11px] leading-tight text-center"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {text}
      </div>
    </td>
  );
}

function Report({ data }: { data: BusinessAnalysisReport }) {
  const { company, branch, uoms, mainStore, finishGoods, comments } = data;
  const { inflow, inflowTotal, outflow, outflowTotal } = finishGoods;

  /** One data row of the Finish Goods table. */
  const fgRow = (r: BusinessAnalysisRow, opts: { bold?: boolean; rule?: "single" | "double" } = {}) => (
    <tr key={r.label} className={opts.bold ? "font-bold" : ""}>
      <td className={`border border-black px-2 py-0.5 text-left ${opts.rule ? "border-t-2" : ""}`}>{r.label}</td>
      {uoms.map((u) => (
        <td key={u} className={`border border-black px-2 py-0.5 text-right ${opts.rule ? "border-t-2" : ""}`}>
          {n2(r.qty[u])}
        </td>
      ))}
      <td className={`border border-black px-2 py-0.5 text-right ${opts.rule ? "border-t-2" : ""}`}>{n2(r.amount)}</td>
    </tr>
  );

  return (
    <div id="report" className="bg-white text-black text-[11px] border border-sage-400 p-5">
      {/* ── Letterhead ── */}
      <div className="text-center">
        <div className="font-extrabold text-[17px] italic">{company.name}</div>
        <div className="text-[10px] italic">{branch.address || company.address}</div>
      </div>

      <div className="border-t-2 border-black my-2" />

      <div className="text-center font-bold underline text-[12px] mb-4">
        Business Analysis Report On {formatDate(data.fromDate)} To {formatDate(data.toDate)}
      </div>

      {/* ── Main Store (raw materials) ──
          Kept because the printed pad has it. Nothing in this system records raw
          purchases or indents, so every figure is zero — the note under the
          table says so rather than letting a reader take the zeros for a fact
          about the month. */}
      <table className="w-full border-collapse border border-black mb-1">
        <tbody>
          <tr className="font-bold text-center">
            <SideLabel text="Main Store" rowSpan={mainStore.rows.length + 1} />
            <td className="border border-black px-2 py-0.5" />
            {mainStore.columns.map((c) => (
              <td key={c} className="border border-black px-2 py-0.5">Qty ({c})</td>
            ))}
            <td className="border border-black px-2 py-0.5">Amount</td>
          </tr>
          {mainStore.rows.map((r) => (
            <tr key={r.label}>
              <td className="border border-black px-2 py-0.5 font-semibold text-left">{r.label}</td>
              {mainStore.columns.map((c) => (
                <td key={c} className="border border-black px-2 py-0.5 text-right">{n2(r.qty[c])}</td>
              ))}
              <td className="border border-black px-2 py-0.5 text-right">{n2(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>      

      {/* ── Finish Goods: the statement proper ──
          Top block is everything the branch had or took in; bottom block is
          everything that left plus what it still holds. The two totals are equal
          in every quantity column and in money. */}
      <table className="w-full border-collapse border border-black">
        <tbody>
          <tr className="font-bold text-center">
            {/* Spans the header plus both blocks and their two total rows. */}
            <SideLabel text="Finish Goods" rowSpan={inflow.length + outflow.length + 3} />
            <td className="border border-black px-2 py-0.5 text-left italic">Particulars</td>
            {uoms.map((u) => (
              <td key={u} className="border border-black px-2 py-0.5">{u}</td>
            ))}
            <td className="border border-black px-2 py-0.5">Amount</td>
          </tr>

          {/* Opening Balance leads the in-block in bold, as the pad prints it. */}
          {inflow.map((r, i) => fgRow(r, { bold: i === 0 }))}
          {fgRow(inflowTotal, { bold: true, rule: "single" })}
          {outflow.map((r) => fgRow(r))}
          {fgRow(outflowTotal, { bold: true, rule: "double" })}
        </tbody>
      </table>
      {/* ── Comments box, as the pad prints it ── */}
      <div className="mt-5">
        <div className="font-semibold mb-1">Comments: ({branch.name || "Factory"})</div>
        <table className="w-full border-collapse border border-black">
          <tbody>
            {[comments.short, comments.over].map((r) => (
              <tr key={r.label}>
                <td className="border border-black px-2 py-0.5 text-center w-1/3">{r.label}</td>
                {uoms.map((u) => (
                  <td key={u} className="border border-black px-2 py-0.5 text-right">{n2(r.qty[u])}</td>
                ))}
                <td className="border border-black px-2 py-0.5 text-right">{n2(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>        
      </div>

      {/* ── Signatures ── kept whole so the block never splits across sheets. */}
      <div className="flex justify-between mt-[1.5in] break-inside-avoid text-[10px] text-center">
        {["Accountant", "Production Manager", "General. Manager.", "Managing Director"].map((l) => (
          <div key={l} className="border-t border-black px-4 pt-1">{l}</div>
        ))}
      </div>
    </div>
  );
}
