// Shared report export: Print, PDF and Excel all render from one column spec,
// so the three outputs can't drift apart. The heavy libs (jsPDF / write-excel-file)
// are dynamically imported so they stay out of the initial bundle and never run
// during SSR.

/** One column of an exportable report. */
export interface ExportColumn<T> {
  header: string;
  /** Cell value. Return a number for numeric columns so Excel keeps it numeric
   *  (sortable / summable) rather than storing it as text. */
  value: (row: T) => string | number | null | undefined;
  /** Right-align in PDF/Excel — use for money and counts. */
  numeric?: boolean;
  /** Excel column width, in characters. */
  width?: number;
}

export interface ReportMeta {
  /** Report name — the document heading and the filename stem. */
  title: string;
  /** Optional context line, e.g. "01-Jul-2026 → 13-Jul-2026". */
  subtitle?: string;
  /** Optional summary row appended under the table (same column count). */
  footer?: (string | number)[];
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const cell = <T,>(col: ExportColumn<T>, row: T) => col.value(row) ?? "";

/** khazana-style filename stem: "Sales Report" → "Sales_Report_2026-07-13". */
function filename(meta: ReportMeta, ext: string) {
  const stamp = new Date().toISOString().split("T")[0];
  const stem = meta.title.trim().replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  return `${stem}_${stamp}.${ext}`;
}

/** Builds the standalone print/preview document — a print stylesheet on the
 *  page itself would need per-page CSS and app chrome hiding; a dedicated
 *  document just contains exactly the exported columns. */
function buildReportDocument<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  meta: ReportMeta,
  autoPrint: boolean,
): string {
  const head = columns
    .map((c) => `<th class="${c.numeric ? "num" : ""}">${esc(c.header)}</th>`)
    .join("");

  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => `<td class="${c.numeric ? "num" : ""}">${esc(cell(c, row))}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const foot = meta.footer
    ? `<tfoot><tr>${meta.footer
        .map((v, i) => `<td class="${columns[i]?.numeric ? "num" : ""}">${esc(v)}</td>`)
        .join("")}</tr></tfoot>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8">
  <title>${esc(meta.title)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color:#111; margin:0; }
    h1 { font-size:18px; margin:0 0 2px; }
    .sub { font-size:12px; color:#555; margin-bottom:12px; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th, td { border:1px solid #999; padding:5px 7px; text-align:left; }
    th { background:#f1f1f1; font-weight:600; }
    td.num, th.num { text-align:right; }
    tfoot td { font-weight:700; background:#f7f7f7; }
    tr { break-inside: avoid; }
    thead { display: table-header-group; }
  </style></head><body>
    <h1>${esc(meta.title)}</h1>
    ${meta.subtitle ? `<div class="sub">${esc(meta.subtitle)}</div>` : ""}
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
      ${foot}
    </table>
    ${autoPrint ? `<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>` : ""}
  </body></html>`;
}

/** Print via a standalone document — see {@link buildReportDocument}. */
export function printReport<T>(rows: T[], columns: ExportColumn<T>[], meta: ReportMeta): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return; // popup blocked — caller surfaces the toast
  w.document.write(buildReportDocument(rows, columns, meta, true));
  w.document.close();
}

/** Open the same document as {@link printReport} in a new tab, without
 *  triggering the print dialog — lets the user check layout/content first. */
export function previewReport<T>(rows: T[], columns: ExportColumn<T>[], meta: ReportMeta): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return; // popup blocked — caller surfaces the toast
  w.document.write(buildReportDocument(rows, columns, meta, false));
  w.document.close();
}

/** Download a real .pdf (jsPDF + autotable). */
export async function exportPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  meta: ReportMeta,
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  // Landscape once a report gets wide enough that portrait would squeeze columns.
  const doc = new jsPDF({
    orientation: columns.length > 5 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  doc.setFontSize(14);
  doc.text(meta.title, 40, 40);
  if (meta.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(meta.subtitle, 40, 56);
    doc.setTextColor(0);
  }

  autoTable(doc, {
    startY: meta.subtitle ? 70 : 56,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(cell(c, row)))),
    foot: meta.footer ? [meta.footer.map((v) => String(v))] : undefined,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [51, 51, 51], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, { halign: c.numeric ? "right" : "left" }]),
    ),
    margin: { left: 40, right: 40 },
  });

  doc.save(filename(meta, "pdf"));
}

/** Download a real .xlsx (write-excel-file). Numeric columns land as numbers, so
 *  the sheet stays sortable and summable rather than storing figures as text. */
export async function exportExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  meta: ReportMeta,
): Promise<void> {
  // The package exposes no root entry — /browser is the client build (the /node
  // one pulls in fs and would break the bundle).
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const excelColumns = columns.map((c) => ({
    width: c.width ?? Math.max(12, c.header.length + 4),
    header: {
      value: c.header,
      fontWeight: "bold" as const,
      backgroundColor: "#F1F1F1",
      align: (c.numeric ? "right" : "left") as "right" | "left",
    },
    cell: (row: T) => {
      const v = cell(c, row);
      if (c.numeric) {
        const n = Number(v);
        // A blank cell (null) beats a 0 or NaN that would skew a column sum.
        if (!Number.isFinite(n)) return null;
        return { value: n, type: Number, align: "right" as const };
      }
      return v === "" ? null : { value: String(v), type: String };
    },
  }));

  await writeXlsxFile(rows, {
    columns: excelColumns,
    sheet: meta.title.slice(0, 31), // Excel caps sheet names at 31 chars
  }).toFile(filename(meta, "xlsx"));
}
