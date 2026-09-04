import { formatDate } from "@/lib/utils";
import type { DailySalesReport } from "./server";

/** Whole taka with thousands separators — the report is read at a glance on a
 *  phone, and the poisha never mattered to it. */
export const tk = (n: number) => Math.round(Number(n ?? 0)).toLocaleString("en-BD");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** `YYYY-MM-DD` read as the calendar date it says, not as UTC midnight — the
 *  same rule `formatDate` follows, so the weekday cannot drift a day. */
const plainDate = (iso: string) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** "01-Sep-2026 (Tuesday)" for a single day; a plain span for a wider range,
 *  where a weekday would be meaningless. */
export const periodLabel = (fromDate: string, toDate: string) =>
  fromDate === toDate
    ? `${formatDate(fromDate)} (${WEEKDAYS[plainDate(fromDate).getDay()]})`
    : `${formatDate(fromDate)} to ${formatDate(toDate)}`;

/**
 * The report as plain text, for WhatsApp.
 *
 * This is the actual deliverable for the outlets — the on-screen sheet is just
 * a preview of it — so it is built from the report data alone and never from
 * anything rendered, and reads exactly as the legacy message always has.
 *
 * Kept free of React so it stays a pure function of the report.
 */
export function buildShareText(report: DailySalesReport): string {
  const { branches, totals } = report;
  const lines: string[] = [];

  const scope = report.branch.id ? ` — ${report.branch.name}` : "";
  lines.push(`Sales Report of ${periodLabel(report.fromDate, report.toDate)}${scope}`, "");

  const block = (label: string, sale: number, invoices: number, online: number, onlineInvoices: number) => {
    lines.push(`${label} Sale =Tk ${tk(sale)}`, `Invoice = ${invoices}`);
    // Only branches that actually took online orders get the two online lines —
    // a run of "Online Sale =Tk 0" would bury the numbers that matter.
    if (online > 0 || onlineInvoices > 0) {
      lines.push(`Online Sale =Tk ${tk(online)}`, `Invoice = ${onlineInvoices}`);
    }
    lines.push("");
  };

  for (const b of branches.filter((x) => !x.isFactory)) {
    block(b.code, b.sale, b.invoiceCount, b.onlineSale, b.onlineInvoiceCount);
  }
  for (const f of branches.filter((x) => x.isFactory)) {
    block("Factory", f.sale, f.invoiceCount, f.onlineSale, f.onlineInvoiceCount);
  }

  lines.push(
    `Total Outlet Sales Tk = ${tk(totals.outletSales)}`,
    `Total Online Tk = ${tk(totals.onlineSales)}`,
    `Total Sale Tk = ${tk(totals.totalSales)}`,
    "",
    `Total (MTD) Tk = ${tk(totals.mtdSales)}`,
  );

  return lines.join("\n");
}
