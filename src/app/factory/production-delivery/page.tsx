"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import {
  fetchProductionDelivery,
  type ProductionDeliveryReport,
  type ProductionDeliveryRow,
  type ProductionDeliveryTotals,
} from "./server";
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

/** The legacy sheet is headed "…On July 2026" when the range covers exactly one
 *  calendar month, which is how the factory normally runs it. Any other range
 *  prints as a span so the heading never misrepresents what was queried. */
const periodLabel = (fromDate: string, toDate: string) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const isMonth =
    from.getUTCDate() === 1 &&
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth() &&
    to.getUTCDate() === new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)).getUTCDate();
  if (isMonth) {
    return `On ${from.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${from.getUTCFullYear()}`;
  }
  return fromDate === toDate ? formatDate(fromDate) : `${formatDate(fromDate)} — ${formatDate(toDate)}`;
};

// Quantities: a dash ONLY when exactly 0 to 2dp. A negative balance is a real
// deficit and MUST print with its sign — never blanked or absolute-valued.
const q = (n: number) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : v.toFixed(2);
};
const tk = (n: number) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return v === 0 ? "-" : formatCurrency(v);
};

/** The paired Qty/Tk column groups, in the order the legacy sheet prints them. */
const GROUPS: { label: string; qty: keyof ProductionDeliveryTotals; amt: keyof ProductionDeliveryTotals }[] = [
  { label: "Opening Balance", qty: "openingQty", amt: "openingTk" },
  { label: "Production Of", qty: "productionQty", amt: "productionTk" },
  { label: "Item Return Receive", qty: "returnQty", amt: "returnTk" },
  { label: "Total Stock", qty: "totalStockQty", amt: "totalStockTk" },
  { label: "Sales", qty: "salesQty", amt: "salesTk" },
  { label: "Reject", qty: "rejectQty", amt: "rejectTk" },
  { label: "Short", qty: "shortQty", amt: "shortTk" },
  { label: "Over", qty: "overQty", amt: "overTk" },
  { label: "Total Delivery", qty: "deliveryQty", amt: "deliveryTk" },
  { label: "Closing Balance", qty: "closingQty", amt: "closingTk" },
];

// Derived from GROUPS so the export can't drift from the on-screen table.
const exportColumns: ExportColumn<ProductionDeliveryRow>[] = [
  { header: "SL", value: (r) => r.sl, numeric: true },
  { header: "Item Code", value: (r) => r.itemCode },
  { header: "Item Name", value: (r) => r.itemName, width: 30 },
  { header: "UOM", value: (r) => r.uom },
  { header: "Rate", value: (r) => r.rate, numeric: true },
  ...GROUPS.flatMap((g) => [
    { header: `${g.label} Qty`, value: (r: ProductionDeliveryRow) => Number(r[g.qty] ?? 0), numeric: true },
    { header: `${g.label} Tk`, value: (r: ProductionDeliveryRow) => Number(r[g.amt] ?? 0), numeric: true },
  ]),
];

const getDefaultMonth = () => {
  const today = new Date();
  const first = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const last = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0));
  return { fromDate: first.toISOString().split("T")[0], toDate: last.toISOString().split("T")[0] };
};

export default function ProductionDeliveryReportPage() {
  const defaults = getDefaultMonth();
  const branchName = useAuthStore((s) => s.user?.branchName) ?? "Factory";
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [report, setReport] = useState<ProductionDeliveryReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runReport = () => {
    setLoading(true);
    fetchProductionDelivery(fromDate, toDate)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        toast.error(getErrorMessage(err, "Failed to load the report"));
      })
      .finally(() => setLoading(false));
  };

  return (
    <AppLayout>
      <PageHeader title="Production & Delivery Report" subtitle={`${branchName} — production, sales and delivery movement`} />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>}
        {/* Print renders the bespoke landscape sheet; PDF/Excel export the table. */}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={report?.items ?? []}
          columns={exportColumns}
          meta={{
            title: "Production & Delivery Report",
            subtitle: [report?.branch.name, periodLabel(fromDate, toDate)].filter(Boolean).join(" · "),
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

function Report({ data }: { data: ProductionDeliveryReport }) {
  const { company, branch, items, totals } = data;

  return (
    <div id="report" className="bg-white text-black text-[11px] border border-sage-400 p-4 overflow-x-auto">
      {/* ── Header ── */}
      <div className="text-center mb-3">
        <div className="font-extrabold text-[16px] italic">{company.name}</div>
        {company.address && <div className="text-[10px] italic">{company.address}</div>}
        <div className="font-semibold">{branch.name}</div>
        <div className="mt-2 font-bold underline text-[13px]">
          Production &amp; Delivery Report {periodLabel(data.fromDate, data.toDate)}
        </div>
      </div>

      {/* ── Item table ── */}
      <table className="w-full border-collapse border border-black text-right">
        <thead>
          <tr className="border-b border-black font-bold text-center">
            <th rowSpan={2} className="border border-gray-400 px-1 py-0.5">SL#</th>
            <th rowSpan={2} className="border border-gray-400 px-1 py-0.5 text-left">Item Name</th>
            <th rowSpan={2} className="border border-gray-400 px-1 py-0.5">Rate</th>
            {GROUPS.map((g) => (
              <th key={g.label} colSpan={2} className="border border-gray-400 px-1 py-0.5 whitespace-nowrap">{g.label}</th>
            ))}
          </tr>
          <tr className="border-b border-black font-bold text-center">
            {GROUPS.map((g) => (
              <FragmentQtyTk key={g.label} />
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
              <td className="border border-sage-300 px-1">{tk(r.rate)}</td>
              {GROUPS.map((g) => (
                <FragmentCells key={g.label} qty={r[g.qty] as number} amt={r[g.amt] as number} />
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td className="border border-sage-400 px-1" colSpan={3}></td>
            {GROUPS.map((g) => (
              <FragmentCells key={g.label} qty={totals[g.qty]} amt={totals[g.amt]} />
            ))}
          </tr>
        </tfoot>
      </table>

      {/* ── Signatures ── */}
      <div className="flex justify-between mt-12 text-[10px] text-center">
        {["Prepared By", "Checked By", "Accountant", "Authorised Sign"].map((label) => (
          <div key={label} className="border-t border-black px-6 pt-1">{label}</div>
        ))}
      </div>
    </div>
  );
}

/** The Qty|Tk sub-header pair repeated under every column group. */
function FragmentQtyTk() {
  return (
    <>
      <th className="border border-gray-400 px-1 py-0.5">Qty</th>
      <th className="border border-gray-400 px-1 py-0.5">Tk</th>
    </>
  );
}

function FragmentCells({ qty, amt }: { qty: number; amt: number }) {
  return (
    <>
      <td className="border border-sage-300 px-1 whitespace-nowrap">{q(qty)}</td>
      <td className="border border-sage-300 px-1 whitespace-nowrap">{tk(amt)}</td>
    </>
  );
}
