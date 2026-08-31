"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import { useAuthStore } from "@/store/auth.store";
import { fetchSalesHistory, type SalesHistoryReport } from "./server";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
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

const fmt = (n: number) => formatCurrency(n ?? 0);
const fmtQty = (n: number) => (n ?? 0).toFixed(2);
/** Qty reads with its unit, e.g. "1.00 (KG)" — the way the printed sheet shows it. */
const fmtQtyUom = (n: number, uom?: string) => `${fmtQty(n)}${uom ? ` (${uom})` : ""}`;
/** Unit price folded with its per-unit share of VAT — shared by the on-screen
 *  table and the Print/PDF/Excel exports so the two can't disagree. */
const priceWithVat = (price: number, vat: number, qty: number) => (price ?? 0) + (qty ? (vat ?? 0) / qty : 0);

/** An invoice contributes one row per item, so its date repeats down the group.
 *  Blank the repeats so each invoice reads as one block on the printed sheet.
 *
 *  Only the Date column uses this now — Inv No and Client Name print on every
 *  line, so a row read on its own is still identified. */
const dedupe = <T,>(rows: T[], key: (row: T) => string) =>
  rows.map((row, i) => (i > 0 && key(rows[i - 1]) === key(row) ? "" : key(row)));

/** One flattened line of the exported sheet. `type` says which of the four it
 *  is — an item, a date subtotal, the blank spacer between dates, or the grand
 *  total — so a column can blank out the cells that don't apply to it. */
interface ExportRow {
  si?: number | string;
  dateHeader?: string;
  type?: string;
  [key: string]: unknown;
}

/** The exported column spec, shared by Print, PDF and Excel. */
const exportColumns: ExportColumn<ExportRow>[] = [
  { header: "SI#", value: (r) => String(r.si ?? "") },
  { header: "Date", value: (r) => String(r.dateHeader ?? "") },
  { header: "Inv No", value: (r) => String(r.invoiceNo ?? "") },
  { header: "Client Name", value: (r) => String(r.clientName ?? ""), width: 24 },
  { header: "Item Name", value: (r) => String(r.itemName ?? "") },
  { header: "Qty", value: (r) => (r.type === "spacer" ? "" : Number(r.qty) || 0), numeric: true },
  // Kept out of Qty so the column stays numeric (sortable/summable) in Excel.
  { header: "UOM", value: (r) => (r.type === "item" ? String(r.uom ?? "") : "") },
  { header: "Price", value: (r) => (r.type === "item" ? fmt(priceWithVat(Number(r.price) || 0, Number(r.vat) || 0, Number(r.qty) || 0)) : ""), numeric: true },
  { header: "Amount", value: (r) => fmt(Number(r.amount) || 0), numeric: true },
  { header: "Discount", value: (r) => fmt(Number(r.discount) || 0), numeric: true },
  { header: "Vat", value: (r) => fmt(Number(r.vat) || 0), numeric: true },
  { header: "Total Amt", value: (r) => fmt(Number(r.totalAmount) || 0), numeric: true },
  { header: "Cash", value: (r) => fmt(Number(r.cash) || 0), numeric: true },
  { header: "Bkash", value: (r) => fmt(Number(r.bkash) || 0), numeric: true },
  { header: "Nagad", value: (r) => fmt(Number(r.nagad) || 0), numeric: true },
  { header: "Brac", value: (r) => fmt(Number(r.brac) || 0), numeric: true },
  { header: "UCB", value: (r) => fmt(Number(r.ucb) || 0), numeric: true },
  { header: "CITY", value: (r) => fmt(Number(r.city) || 0), numeric: true },
  { header: "EBL", value: (r) => fmt(Number(r.ebl) || 0), numeric: true },
  { header: "F Panda", value: (r) => fmt(Number(r.fpanda) || 0), numeric: true },
  { header: "Pathao", value: (r) => fmt(Number(r.pathao) || 0), numeric: true },
  { header: "Foodi", value: (r) => fmt(Number(r.foodi) || 0), numeric: true },
  { header: "Credit", value: (r) => fmt(Number(r.credit) || 0), numeric: true },
];

export default function SalesHistoryPage() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [allBranches, setAllBranches] = useState(false);
  const [report, setReport] = useState<SalesHistoryReport | null>(null);
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
    if (!allBranches && !branchId) return;
    setLoading(true);
    fetchSalesHistory(fromDate, toDate, allBranches ? undefined : branchId)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  const groupByDate = (): Array<[string, SalesHistoryReport['items']]> => {
    if (!report) return [];
    const grouped = new Map<string, SalesHistoryReport['items']>();
    report.items.forEach((item) => {
      const dateStr = String(item.date).split('T')[0];
      if (!grouped.has(dateStr)) grouped.set(dateStr, []);
      grouped.get(dateStr)!.push(item);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const calculateGrandTotal = () => {
    if (!report) return null;
    return report.dailySubTotals.reduce(
      (acc, daily) => ({
        qty: acc.qty + (daily.qty || 0),
        amount: acc.amount + (daily.amount || 0),
        discount: acc.discount + (daily.discount || 0),
        vat: acc.vat + (daily.vat || 0),
        totalAmount: acc.totalAmount + (daily.totalAmount || 0),
        cash: acc.cash + (daily.cash || 0),
        bkash: acc.bkash + (daily.bkash || 0),
        nagad: acc.nagad + (daily.nagad || 0),
        brac: acc.brac + (daily.brac || 0),
        ucb: acc.ucb + (daily.ucb || 0),
        city: acc.city + (daily.city || 0),
        ebl: acc.ebl + (daily.ebl || 0),
        fpanda: acc.fpanda + (daily.fpanda || 0),
        pathao: acc.pathao + (daily.pathao || 0),
        foodi: acc.foodi + (daily.foodi || 0),
        credit: acc.credit + (daily.credit || 0),
      }),
      { qty: 0, amount: 0, discount: 0, vat: 0, totalAmount: 0, cash: 0, bkash: 0, nagad: 0, brac: 0, ucb: 0, city: 0, ebl: 0, fpanda: 0, pathao: 0, foodi: 0, credit: 0 }
    );
  };

  /**
   * The rows and columns behind Print, PDF and Excel alike — one spec, so the
   * printed sheet, the PDF and the spreadsheet can't drift apart. Flattens the
   * grouped on-screen layout into a single table: item lines, a subtotal row per
   * date, a blank spacer between dates, and the grand total last.
   */
  const buildExportData = () => {
    if (!report) return { rows: [] as ExportRow[], columns: exportColumns };

    const rows: ExportRow[] = [];
    const groupedByDate = groupByDate();
    let siCounter = 1;

    groupedByDate.forEach(([dateStr, dateItems]) => {
      // Date still prints once per invoice; Inv No and Client Name repeat on
      // every line. A row lifted out of the sheet — filtered, sorted or pasted
      // elsewhere — has to say which invoice and which customer it belongs to
      // on its own, which a blanked continuation row cannot do.
      const invoiceLabels = dedupe(dateItems, (r) => r.invoiceNo ?? "");
      dateItems.forEach((item, idx) => {
        rows.push({
          ...item,
          type: "item",
          si: siCounter++,
          dateHeader: invoiceLabels[idx] ? formatDate(dateStr) : "",
        });
      });

      const dateSubTotal = report.dailySubTotals.find((d) => {
        const dStr = String(d.date).split('T')[0];
        return dStr === dateStr;
      });

      if (dateSubTotal) {
        rows.push({
          ...dateSubTotal,
          type: "date-subtotal",
          si: "",
          dateHeader: "Date Subtotal",
        });
      }

      rows.push({ type: "spacer" });
    });

    const grandTotal = calculateGrandTotal();
    if (grandTotal) {
      rows.push({
        ...grandTotal,
        type: "grand-total",
        si: "",
        dateHeader: "GRAND TOTAL",
      });
    }

    return { rows, columns: exportColumns };
  };

  const { rows: exportRows, columns: exportCols } = buildExportData();
  const exportMeta = {
    title: "Sales History Summary",
    subtitle: report
      ? `${report.branchName || "All Branches"} · ${formatDate(report.fromDate)} to ${formatDate(report.toDate)}`
      : "",
  };

  return (
    <AppLayout>
      <PageHeader title="Sales History Summary" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input
          label="From Date"
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }}
          className="w-40"
        />
        <Input
          label="To Date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-40"
        />
        <Select
          label="Branch"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-48"
          disabled={allBranches}
        />
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 select-none">
          <input
            type="checkbox"
            checked={allBranches}
            onChange={(e) => setAllBranches(e.target.checked)}
            className="h-4 w-4 rounded border-sage-400 text-primary-800 focus:ring-primary-800"
          />
          All Branches
        </label>
        <Button onClick={runReport} loading={loading} className="mb-0.5">
          Run Report
        </Button>
        {/* Print / PDF / Excel all render the report on its own — `window.print()`
            used to hand the browser the whole app page (nav, filter bar and all)
            because nothing here scopes the print to the report. */}
        {report && (
          <ReportExportButtons
            rows={exportRows}
            columns={exportCols}
            meta={exportMeta}
            className="mb-0.5"
            showPreview
          />
        )}
      </div>

      {report && (
        <div className="bg-white rounded-lg border border-sage-300 overflow-hidden">
          <div className="p-4 border-b border-sage-300">
            <h2 className="text-center text-lg font-semibold">{report.branchName || "All Branches"}</h2>
            {report.branchAddress && <p className="text-center text-sm text-gray-600">{report.branchAddress}</p>}
            <p className="text-center text-sm text-gray-600 mt-1">
              Sales History Summary On : {formatDate(report.fromDate)} to {formatDate(report.toDate)}
            </p>
          </div>

          {groupByDate().map(([dateStr, dateItems]) => {
            const dateSubTotal = report.dailySubTotals.find((d) => {
              const dStr = String(d.date).split('T')[0];
              return dStr === dateStr;
            });

            return (
              <div key={dateStr} className="border-b border-sage-300">
                <div className="bg-sage-100 px-4 py-2 border-b border-sage-300">
                  <h3 className="font-semibold text-sm">Date: {formatDate(dateStr)}</h3>
                </div>
                <div className="overflow-x-auto">
                  <Table
                    loading={false}
                    // Inv No and Client Name repeat on every line, so any row
                    // read on its own still says which invoice it came from.
                    data={dateItems.map((item, idx) => ({
                      id: `${dateStr}-${idx}`,
                      ...item,
                      si: idx + 1,
                    }))}
                    columns={[
                      { key: "si", header: "SI#", className: "w-12" },
                      { key: "invoiceNo", header: "Inv No" },
                      { key: "clientName", header: "Client Name", render: (r) => r.clientName || "" },
                      { key: "itemName", header: "Item Name" },
                      { key: "qty", header: "Qty", className: "text-right whitespace-nowrap", render: (r) => fmtQtyUom(r.qty, r.uom) },
                      { key: "price", header: "Price", className: "text-right", render: (r) => fmt(priceWithVat(r.price, r.vat, r.qty)) },
                      { key: "amount", header: "Amount", className: "text-right", render: (r) => fmt(r.amount) },
                      { key: "discount", header: "Discount", className: "text-right", render: (r) => fmt(r.discount) },
                      { key: "vat", header: "Vat", className: "text-right", render: (r) => fmt(r.vat) },
                      { key: "totalAmount", header: "Total Amt", className: "text-right", render: (r) => fmt(r.totalAmount) },
                      { key: "cash", header: "Cash", className: "text-right", render: (r) => fmt(r.cash) },
                      { key: "bkash", header: "Bkash", className: "text-right", render: (r) => fmt(r.bkash) },
                      { key: "nagad", header: "Nagad", className: "text-right", render: (r) => fmt(r.nagad) },
                      { key: "brac", header: "Brac", className: "text-right", render: (r) => fmt(r.brac) },
                      { key: "ucb", header: "UCB", className: "text-right", render: (r) => fmt(r.ucb) },
                      { key: "city", header: "CITY", className: "text-right", render: (r) => fmt(r.city) },
                      { key: "ebl", header: "EBL", className: "text-right", render: (r) => fmt(r.ebl) },
                      { key: "fpanda", header: "F Panda", className: "text-right", render: (r) => fmt(r.fpanda) },
                      { key: "pathao", header: "Pathao", className: "text-right", render: (r) => fmt(r.pathao) },
                      { key: "foodi", header: "Foodi", className: "text-right", render: (r) => fmt(r.foodi) },
                      { key: "credit", header: "Credit", className: "text-right", render: (r) => fmt(r.credit) },
                    ]}
                  />
                </div>
                {dateSubTotal && (
                  <div className="bg-sage-100 overflow-x-auto border-t border-sage-300">
                    <Table
                      loading={false}
                      data={[{ id: `subtotal-${dateStr}`, ...dateSubTotal }]}
                      columns={[
                        { key: "date", header: "Date Subtotal", render: () => "Subtotal" },
                        { key: "qty", header: "Qty", className: "text-right", render: (r) => fmtQty(r.qty) },
                        { key: "amount", header: "Amount", className: "text-right font-semibold", render: (r) => fmt(r.amount) },
                        { key: "discount", header: "Discount", className: "text-right font-semibold", render: (r) => fmt(r.discount) },
                        { key: "vat", header: "Vat", className: "text-right font-semibold", render: (r) => fmt(r.vat) },
                        { key: "totalAmount", header: "Total Amt", className: "text-right font-semibold", render: (r) => fmt(r.totalAmount) },
                        { key: "cash", header: "Cash", className: "text-right font-semibold", render: (r) => fmt(r.cash) },
                        { key: "bkash", header: "Bkash", className: "text-right font-semibold", render: (r) => fmt(r.bkash) },
                        { key: "nagad", header: "Nagad", className: "text-right font-semibold", render: (r) => fmt(r.nagad) },
                        { key: "brac", header: "Brac", className: "text-right font-semibold", render: (r) => fmt(r.brac) },
                        { key: "ucb", header: "UCB", className: "text-right font-semibold", render: (r) => fmt(r.ucb) },
                        { key: "city", header: "CITY", className: "text-right font-semibold", render: (r) => fmt(r.city) },
                        { key: "ebl", header: "EBL", className: "text-right font-semibold", render: (r) => fmt(r.ebl) },
                        { key: "fpanda", header: "F Panda", className: "text-right font-semibold", render: (r) => fmt(r.fpanda) },
                        { key: "pathao", header: "Pathao", className: "text-right font-semibold", render: (r) => fmt(r.pathao) },
                        { key: "foodi", header: "Foodi", className: "text-right font-semibold", render: (r) => fmt(r.foodi) },
                        { key: "credit", header: "Credit", className: "text-right font-semibold", render: (r) => fmt(r.credit) },
                      ]}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {report.dailySubTotals.length > 0 && (() => {
            const grand = calculateGrandTotal();
            return (
              <div className="bg-green-50 overflow-x-auto border-t-2 border-green-200">
                <Table
                  loading={false}
                  data={[{ id: "grand-total", ...(grand || {}) }]}
                  columns={[
                    { key: "qty", header: "GRAND TOTAL", className: "text-right font-bold text-green-900", render: () => "GRAND TOTAL" },
                    { key: "qty", header: "Qty", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmtQty(Number(r.qty) || 0) },
                    { key: "amount", header: "Amount", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.amount) || 0) },
                    { key: "discount", header: "Discount", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.discount) || 0) },
                    { key: "vat", header: "Vat", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.vat) || 0) },
                    { key: "totalAmount", header: "Total Amt", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.totalAmount) || 0) },
                    { key: "cash", header: "Cash", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.cash) || 0) },
                    { key: "bkash", header: "Bkash", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.bkash) || 0) },
                    { key: "nagad", header: "Nagad", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.nagad) || 0) },
                    { key: "brac", header: "Brac", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.brac) || 0) },
                    { key: "ucb", header: "UCB", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.ucb) || 0) },
                    { key: "city", header: "CITY", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.city) || 0) },
                    { key: "ebl", header: "EBL", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.ebl) || 0) },
                    { key: "fpanda", header: "F Panda", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.fpanda) || 0) },
                    { key: "pathao", header: "Pathao", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.pathao) || 0) },
                    { key: "foodi", header: "Foodi", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.foodi) || 0) },
                    { key: "credit", header: "Credit", className: "text-right font-bold text-green-900", render: (r: Record<string, unknown>) => fmt(Number(r.credit) || 0) },
                  ]}
                />
              </div>
            );
          })()}
        </div>
      )}
    </AppLayout>
  );
}
