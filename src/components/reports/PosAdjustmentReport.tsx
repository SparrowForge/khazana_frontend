"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Logo from "@/components/ui/Logo";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import {
  fetchPosAdjustmentReport,
  POS_ADJUSTMENT_LABELS,
  type PosAdjustmentKind,
  type PosAdjustmentReport as Report,
} from "@/lib/reports/posAdjustment";
import type { ExportColumn } from "@/lib/export/reportExport";

/**
 * The 80mm counter print of the ItemReject sheet — Reject, Excess and Short.
 *
 * They are three columns of one database row printed on one form, so there is a
 * single implementation and `kind` chooses the column and the wording. Forking
 * it would mean every future change to the layout has to be made three times.
 */

/** Sentinel for the branch picker. An empty value would read as "nothing
 *  chosen" and let the placeholder show; All Branches is a real choice here,
 *  and it has to be reachable again after the default branch is replaced. */
const ALL = "ALL";

/** The legacy sheet's date style: "23-Dec-20". Read in UTC so a date stored at
 *  midnight doesn't slip a day west of Greenwich. */
const formatDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day}-${mon}-${String(d.getUTCFullYear()).slice(-2)}`;
};

const n2 = (n: number) => (Number(n) || 0).toFixed(2);

export default function PosAdjustmentReportPage({ kind }: { kind: PosAdjustmentKind }) {
  const labels = POS_ADJUSTMENT_LABELS[kind];
  const today = new Date().toISOString().split("T")[0];
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Defaults to the logged-in branch once the session has hydrated; the user
  // may switch it, including to All Branches.
  const [branchId, setBranchId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches({ page: 1, limit: 100 })
      .then(({ items }) => setBranches(items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionBranchId) setBranchId((b) => b || sessionBranchId);
  }, [sessionBranchId]);

  // Switching between these reports must not leave the previous one's rows on
  // screen under the new heading.
  useEffect(() => {
    setReport(null);
  }, [kind]);

  const runReport = () => {
    setLoading(true);
    fetchPosAdjustmentReport(kind, fromDate, toDate, branchId === ALL ? undefined : branchId || undefined)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  // Branch order follows SortingNo (the reading order of the printed forms);
  // a branch without one sorts last rather than jumping to the head.
  const branchOptions = useMemo(
    () => [
      { value: ALL, label: "All Branches" },
      ...[...branches]
        .sort((a, b) => (a.sortingNo ?? Infinity) - (b.sortingNo ?? Infinity))
        .map((b) => ({ value: String(b.id), label: b.branchName })),
    ],
    [branches],
  );

  // Excel/PDF get the same lines flattened, with the grouping date carried onto
  // every row — a spreadsheet has no room for a group header.
  const exportRows = useMemo(
    () => (report?.days ?? []).flatMap((d) => d.items.map((i) => ({ date: d.date, ...i }))),
    [report],
  );

  const exportColumns: ExportColumn<(typeof exportRows)[number]>[] = [
    { header: "Date", value: (r) => formatDate(r.date) },
    { header: "Item Name", value: (r) => r.itemName, width: 28 },
    { header: "UOM", value: (r) => r.uom },
    { header: labels.qtyHeader, value: (r) => r.qty, numeric: true },
    { header: "Amount", value: (r) => r.amount, numeric: true },
  ];

  return (
    <AppLayout>
      <PageHeader title={labels.pageTitle} />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Branch"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={branchOptions}
          className="w-48"
        />
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={exportRows}
          columns={exportColumns}
          meta={{
            title: labels.docTitle,
            subtitle: [report?.branch.name, `${formatDate(fromDate)} — ${formatDate(toDate)}`]
              .filter(Boolean)
              .join(" · "),
          }}
        />
      </div>

      {report && (
        <>
          {/* The 80mm roll the POS terminal prints on, set the same way the
              sales receipt sets it (see InvoicePrintStyles): the @page rule has
              to name the paper, or the browser falls back to A4 and drops this
              narrow receipt into the corner of a big sheet. `auto` height lets
              the roll run as long as the report needs. */}
          <style>{`
            /* The logo is whatever /logo.png happens to be — a wide wordmark at
               34px tall is wider than the roll and would print cut off down the
               right edge, taking the Amount column with it. Cap it to the
               receipt instead of trusting the asset's aspect ratio. */
            #pos-adjustment img { max-width: 100% !important; height: auto !important; }
            @media print {
              body * { visibility: hidden !important; }
              #pos-adjustment, #pos-adjustment * { visibility: visible !important; }
              #pos-adjustment {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                /* 80mm box on an 80mm page, so the 4mm padding is the roll's
                   own quiet margin and nothing can sit past the paper edge. */
                width: 80mm !important;
                padding: 4mm !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
              }
              .no-print { display: none !important; }
            }
            @page { size: 80mm auto; margin: 0; }
          `}</style>
          <Receipt data={report} labels={labels} />
        </>
      )}
    </AppLayout>
  );
}

function Receipt({
  data,
  labels,
}: {
  data: Report;
  labels: (typeof POS_ADJUSTMENT_LABELS)[PosAdjustmentKind];
}) {
  const { branch, days, grandTotal } = data;
  const empty = days.length === 0;

  return (
    <div
      id="pos-adjustment"
      className="bg-white text-black text-[11px] w-[302px] mx-auto p-3 border border-sage-400 shadow-sm"
    >
      {/* Header block: the branch's own identity, exactly as on the sales receipt */}
      <div className="text-center leading-tight">
        <Logo size={34} className="justify-center" />
        <div className="font-semibold mt-0.5">
          {branch.name}
          {branch.id ? " Branch" : ""}
        </div>
        {branch.address && <div className="text-[10px]">{branch.address}</div>}
        {branch.vatNo && <div className="text-[10px] font-semibold">Vat: {branch.vatNo}</div>}
        {branch.mobileNo && <div className="text-[10px] font-semibold">Cell: {branch.mobileNo}</div>}
      </div>

      <div className="text-center mt-2 leading-tight">
        <div className="font-semibold">{labels.docTitle}</div>
        <div className="text-[10px]">
          <span className="font-semibold">On </span>
          {formatDate(data.fromDate)}
          <span className="font-semibold"> to </span>
          {formatDate(data.toDate)}
        </div>
      </div>

      <table className="w-full border-collapse border border-black mt-1.5 table-fixed">
        <colgroup>
          <col style={{ width: "46%" }} />
          <col style={{ width: "27%" }} />
          <col style={{ width: "27%" }} />
        </colgroup>
        <thead>
          <tr className="font-bold">
            <th className="border border-black px-1 py-0.5 text-left">Item Name</th>
            <th className="border border-black px-1 py-0.5 text-left">{labels.qtyHeader}</th>
            <th className="border border-black px-1 py-0.5 text-left">Amount</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <Fragment key={day.date}>
              {/* The day is a full-width band, not a column — every line under
                  it belongs to that date until the next band. */}
              <tr>
                <td className="border border-black px-1 py-0.5 font-bold" colSpan={3}>
                  {formatDate(day.date)}
                </td>
              </tr>
              {day.items.map((line) => (
                <tr key={`${line.itemCode}-${line.itemName}`}>
                  <td className="border border-black px-1 py-0.5 align-top break-words">{line.itemName}</td>
                  <td className="border border-black px-1 py-0.5 align-top">
                    {n2(line.qty)}
                    {line.uom ? ` ${line.uom}` : ""}
                  </td>
                  <td className="border border-black px-1 py-0.5 align-top text-right">{n2(line.amount)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-black px-1 py-0.5 text-center">Sub Total</td>
                <td className="border border-black px-1 py-0.5">{n2(day.subTotalQty)}</td>
                <td className="border border-black px-1 py-0.5 text-right">{n2(day.subTotalAmount)}</td>
              </tr>
            </Fragment>
          ))}
          {empty && (
            <tr>
              <td className="border border-black px-2 py-3 text-center text-gray-600" colSpan={3}>
                {labels.emptyText}
              </td>
            </tr>
          )}
        </tbody>
        {!empty && (
          <tfoot>
            <tr className="font-bold">
              <td className="border border-black px-1 py-0.5 text-center">Grand Total</td>
              <td className="border border-black px-1 py-0.5">{n2(grandTotal.qty)}</td>
              <td className="border border-black px-1 py-0.5 text-right">{n2(grandTotal.amount)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
