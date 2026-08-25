"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import { fetchDailyFinalReport, type DailyFinalReport } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";

const money = (n: number) => formatCurrency(n ?? 0);
const kg = (n: number) => (n ?? 0).toFixed(2);
const pcs = (n: number) => String(Math.round(n ?? 0));

/** The report is a multi-section sheet, not one table, so PDF/Excel get a
 *  flattened Section/Label/Detail/Amount view of the same numbers. Print keeps
 *  the bespoke layout below — that's the document people actually hand over. */
interface FinalFlatRow {
  section: string;
  label: string;
  detail: string;
  amount: number;
}

const exportColumns: ExportColumn<FinalFlatRow>[] = [
  { header: "Section", value: (r) => r.section, width: 26 },
  { header: "Label", value: (r) => r.label, width: 24 },
  { header: "Detail", value: (r) => r.detail, width: 20 },
  { header: "Amount", value: (r) => r.amount, numeric: true },
];

function toFlatRows(d: DailyFinalReport): FinalFlatRow[] {
  const { categories: c, payments: p, totals: t, breakdown, cardBank, salesCorrection, hourwise } = d;
  const rows: FinalFlatRow[] = [];

  const categories: [string, DailyFinalReport["categories"]["regular"]][] = [
    ["Regular Sale", c.regular],
    ["Assorted Sale", c.assorted],
    ["Issue Sale", c.issue],
    ["Credit Sale", c.credit],
  ];
  for (const [label, r] of categories) {
    rows.push({
      section: "Sale Categories",
      label,
      detail: `Kg ${kg(r.kg)} / Pcs ${pcs(r.pcs)}`,
      amount: r.amount ?? 0,
    });
  }

  const payModes: [string, number][] = [
    ["Bkash", p.bkash], ["Card", p.card], ["Cash", p.cash], ["Credit", p.credit],
  ];
  for (const [label, amount] of payModes) {
    rows.push({ section: "Payment Modes", label, detail: "", amount: amount ?? 0 });
  }

  const totals: [string, number][] = [
    ["Total Sale", t.totalSale], ["NC Sale", t.ncSale],
    ["Discount", t.discount], ["Grand Total", t.grandTotal],
  ];
  for (const [label, amount] of totals) {
    rows.push({ section: "Totals", label, detail: "", amount: amount ?? 0 });
  }

  for (const r of breakdown.credit) {
    rows.push({ section: "Discount & NC BreakDown", label: `Credit — ${r.name}`, detail: r.contact, amount: r.amount ?? 0 });
  }
  for (const r of breakdown.discount) {
    // `detail` is the human-readable breakdown the sheet prints in place of the
    // amount; keep the numeric amount for Excel and carry detail alongside it.
    rows.push({
      section: "Discount & NC BreakDown",
      label: `Discount — ${r.name}`,
      detail: [r.contact, r.detail].filter(Boolean).join(" · "),
      amount: r.amount ?? 0,
    });
  }
  for (const r of breakdown.nc) {
    rows.push({ section: "Discount & NC BreakDown", label: `NC — ${r.name}`, detail: r.contact, amount: r.amount ?? 0 });
  }

  for (const b of cardBank) {
    rows.push({ section: "Card Bank BreakDown", label: b.bank, detail: "", amount: b.amount ?? 0 });
  }

  for (const r of salesCorrection) {
    rows.push({ section: "Sales Correction BreakDown", label: r.invNo, detail: r.name, amount: r.chgAmt ?? 0 });
  }

  for (const h of hourwise) {
    rows.push({ section: "Hourwise Sales BreakDown", label: h.label, detail: `Qty ${kg(h.qty)}`, amount: h.amount ?? 0 });
  }

  return rows;
}

export default function DailyFinalReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const branchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<DailyFinalReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runReport = () => {
    if (!branchId) return;
    setLoading(true);
    fetchDailyFinalReport(date, branchId)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  return (
    <AppLayout>
      <PageHeader title="Daily Final Report" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && (
          <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>
        )}
        {/* Print above renders the bespoke sheet; PDF/Excel export the same
            figures in a flattened, spreadsheet-friendly form. */}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={report ? toFlatRows(report) : []}
          columns={exportColumns}
          meta={{
            title: "Daily Final Report",
            subtitle: `${report?.branch.name ?? ""} · ${formatDate(date)}`.trim(),
          }}
        />
      </div>

      {report && (
        <>
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #report, #report * { visibility: visible !important; }
              #report { position: fixed !important; top: 0; left: 0; width: 80mm !important; margin: 0 !important; }
              .no-print { display: none !important; }
            }
          `}</style>
          <Report data={report} />
        </>
      )}
    </AppLayout>
  );
}

// ── Report body (mirrors the printed Daily Final Report) ─────────────
function Report({ data }: { data: DailyFinalReport }) {
  const { branch, categories: c, payments: p, totals: t, breakdown, cardBank, salesCorrection, hourwise } = data;
  const hourTotal = hourwise.reduce((s, h) => s + h.amount, 0);

  return (
    <div
      id="report"
      className="mx-auto w-[320px] bg-white text-black text-[11px] leading-tight border border-sage-400 p-3 print:border-0"
    >
      {/* ── Header ── */}
      <div className="text-center mb-2">
        <div className="font-extrabold text-[15px] tracking-wide text-red-600">
          KHAZANA <span className="text-gray-800">MITHAI</span>
        </div>
        <div className="font-semibold">{branch.name}</div>
        {branch.address && <div className="text-[10px]">{branch.address}</div>}
        {branch.vatNo && <div className="text-[10px]">Vat Number: {branch.vatNo}</div>}
        <div className="font-bold text-red-600 mt-1">Daliy Final Report</div>
        <div className="text-[10px]">Date {formatDate(data.date)}</div>
      </div>

      {/* ── Sale categories (Qty Kg / Pcs / Sale) ── */}
      <table className="w-full border-collapse mb-2">
        <thead>
          <tr className="border-y border-black font-bold">
            <th className="text-left py-0.5"></th>
            <th className="text-right">Kg</th>
            <th className="text-right">Pcs</th>
            <th className="text-right">Sale</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Regular Sale", c.regular],
            ["Assorted Sale", c.assorted],
            ["Issue Sale", c.issue],
            ["Credit Sale", c.credit],
          ].map(([label, row]) => {
            const r = row as DailyFinalReport["categories"]["regular"];
            return (
              <tr key={label as string} className="border-b border-sage-300">
                <td className="font-semibold py-0.5">{label as string}</td>
                <td className="text-right">{kg(r.kg)}</td>
                <td className="text-right">{pcs(r.pcs)}</td>
                <td className="text-right">{money(r.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Payment modes ── */}
      <table className="w-full border-collapse mb-2 border border-black">
        <tbody>
          {[
            ["Bkash", p.bkash],
            ["Card", p.card],
            ["Cash", p.cash],
            ["Credit", p.credit],
          ].map(([label, val]) => (
            <tr key={label as string} className="border-b border-sage-400">
              <td className="font-bold py-0.5 px-2">{label as string}</td>
              <td className="text-right font-semibold px-2">{money(val as number)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div className="mb-3 border-t border-b border-black py-1">
        <TotalLine label="Total Sale" value={t.totalSale} />
        <TotalLine label="NC Sale" value={t.ncSale} />
        <TotalLine label="Discount" value={t.discount} />
        <div className="border-t border-black mt-1 pt-1">
          <TotalLine label="Grand Total" value={t.grandTotal} bold />
        </div>
      </div>

      {/* ── Discount & NC breakdown ── */}
      <SectionTitle>Discount &amp; NC BreakDown</SectionTitle>
      <table className="w-full border-collapse mb-3 border border-black">
        <thead>
          <tr className="border-b border-black font-bold text-left">
            <th className="py-0.5 px-1">Name</th>
            <th className="px-1">Contact</th>
            <th className="text-right px-1">Amount</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.credit.length > 0 && <GroupRow label="Credit" />}
          {breakdown.credit.map((r, i) => (
            <BreakRow key={`cr-${i}`} name={r.name} contact={r.contact} amount={money(r.amount)} />
          ))}
          {breakdown.discount.length > 0 && <GroupRow label="Discount" />}
          {breakdown.discount.map((r, i) => (
            <BreakRow key={`ds-${i}`} name={r.name} contact={r.contact} amount={r.detail} />
          ))}
          {breakdown.nc.length > 0 && <GroupRow label="NC" />}
          {breakdown.nc.map((r, i) => (
            <BreakRow key={`nc-${i}`} name={r.name} contact={r.contact} amount={money(r.amount)} />
          ))}
          {breakdown.credit.length + breakdown.discount.length + breakdown.nc.length === 0 && (
            <EmptyRow cols={3} />
          )}
        </tbody>
      </table>

      {/* ── Card Bank breakdown ── */}
      <SectionTitle>Card Bank BreakDown</SectionTitle>
      <table className="w-full border-collapse mb-3 border border-black">
        <tbody>
          {cardBank.length > 0 ? (
            cardBank.map((b, i) => (
              <tr key={i} className="border-b border-sage-400">
                <td className="font-bold py-0.5 px-2">{b.bank}</td>
                <td className="text-right font-semibold px-2">{money(b.amount)}</td>
              </tr>
            ))
          ) : (
            <EmptyRow cols={2} />
          )}
        </tbody>
      </table>

      {/* ── Sales correction breakdown ── */}
      <SectionTitle>Sales Correction BreakDown</SectionTitle>
      <table className="w-full border-collapse mb-3 border border-black">
        <thead>
          <tr className="border-b border-black font-bold text-left">
            <th className="py-0.5 px-1">Invoice No</th>
            <th className="px-1">Name</th>
            <th className="text-right px-1">Chg Amt</th>
          </tr>
        </thead>
        <tbody>
          {salesCorrection.length > 0 ? (
            salesCorrection.map((r, i) => (
              <tr key={i} className="border-b border-sage-300">
                <td className="py-0.5 px-1">{r.invNo}</td>
                <td className="px-1">{r.name}</td>
                <td className="text-right px-1">{money(r.chgAmt)}</td>
              </tr>
            ))
          ) : (
            <EmptyRow cols={3} />
          )}
        </tbody>
      </table>

      {/* ── Hourwise sales breakdown ── */}
      <SectionTitle>Hourwise Sales BreakDown</SectionTitle>
      <table className="w-full border-collapse border border-black">
        <thead>
          <tr className="border-b border-black font-bold">
            <th className="text-left py-0.5 px-1">Time</th>
            <th className="text-right px-1">Qty</th>
            <th className="text-right px-1">Amount</th>
          </tr>
        </thead>
        <tbody>
          {hourwise.length > 0 ? (
            hourwise.map((h) => (
              <tr key={h.hour} className="border-b border-sage-300">
                <td className="py-0.5 px-1">{h.label}</td>
                <td className="text-right px-1">{kg(h.qty)}</td>
                <td className="text-right px-1">{money(h.amount)}</td>
              </tr>
            ))
          ) : (
            <EmptyRow cols={3} />
          )}
        </tbody>
        {hourwise.length > 0 && (
          <tfoot>
            <tr className="border-t border-black font-bold">
              <td className="py-0.5 px-1 text-center">Total Sales</td>
              <td className="px-1"></td>
              <td className="text-right px-1">{money(hourTotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────
function TotalLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between px-1 ${bold ? "font-extrabold text-[12px]" : "font-semibold"}`}>
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-center font-bold mb-1">{children}</div>;
}

function GroupRow({ label }: { label: string }) {
  return (
    <tr className="border-y border-black bg-sage-100">
      <td colSpan={3} className="font-bold py-0.5 px-1">{label}</td>
    </tr>
  );
}

function BreakRow({ name, contact, amount }: { name: string; contact: string; amount: string }) {
  return (
    <tr className="border-b border-sage-300">
      <td className="py-0.5 px-1">{name}</td>
      <td className="px-1">{contact}</td>
      <td className="text-right px-1">{amount}</td>
    </tr>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center text-gray-400 py-1.5 text-[10px]">No records</td>
    </tr>
  );
}
