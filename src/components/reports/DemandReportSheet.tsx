"use client";
import { formatCurrency } from "@/lib/utils";
import type { DemandReport } from "@/app/factory/demand-report/server";

// The Demand Report sheet itself — the A4 document, with no filter bar and no
// buttons around it. Lives here rather than in the report page because the
// public share link renders exactly the same sheet to someone with no session,
// and a shared report that drifted from the staff one would be worse than no
// share at all.

export const formatDate = (dateString: string | Date) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day}-${month}-${date.getUTCFullYear()}`;
};

/** The printed form is headed "Demand Report of <date>". A range keeps both
 *  ends so the heading never misrepresents what was queried. */
export const periodLabel = (fromDate: string, toDate: string) =>
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

/** Print rules, mounted alongside the sheet by whichever page renders it. */
export const DemandReportPrintStyles = () => (
  <style>{`
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      body * { visibility: hidden !important; }
      #report, #report * { visibility: visible !important; }
      #report { position: absolute; top: 0; left: 0; width: 100%; }
      .no-print { display: none !important; }
    }
  `}</style>
);

export default function DemandReportSheet({ data }: { data: DemandReport }) {
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

      {/* Rows are the items actually demanded, so an empty table means nothing
          matched — said out loud rather than left as a bare "No items found". */}
      {items.length === 0 && (
        <div className="no-print mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          No demand orders were found for this date range
          {branches.length ? ` (${branches.map((b) => b.code || b.name).join(", ")})` : ""}. Check the From/To
          dates against the demand order dates, and the Order Type filter.
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
              <td className="border border-black px-1 text-right">{money(r.rate)}</td>
              {branches.map((b) => (
                <td key={b.id} className="border border-black px-1 text-right">{q(r.qtyByBranch[b.id])}</td>
              ))}
              <td className="border border-black px-1 text-right font-medium">{q(r.totalQty)}</td>
              {/* Every row here was demanded, so a blank Amount can only mean the
                  item has no active price. Shown as "-" rather than empty, so a
                  missing price reads as a missing price. */}
              <td className="border border-black px-1 text-right">{money(r.amount)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="border border-black px-2 py-3 text-center text-gray-500" colSpan={branches.length + 5}>
                No items were demanded in this period.
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
