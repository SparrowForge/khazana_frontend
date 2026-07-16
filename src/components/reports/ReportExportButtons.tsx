"use client";
import { useState } from "react";
import { Eye, Printer, FileText, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import {
  printReport,
  previewReport,
  exportPdf,
  exportExcel,
  type ExportColumn,
  type ReportMeta,
} from "@/lib/export/reportExport";

interface ReportExportButtonsProps<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  meta: ReportMeta;
  className?: string;
  /** Set false on reports that already print their own bespoke layout (the
   *  Daily Final / Stock Analysis sheets) — their styled print is the real
   *  document, so we don't want a second, generic print path next to it. */
  showPrint?: boolean;
  /** Opt-in — a "Preview" button that opens the print layout in a new tab
   *  without triggering the print dialog. Off by default so existing report
   *  pages don't sprout a new button unasked. */
  showPreview?: boolean;
}

/**
 * Print / PDF / Excel for a report. All three render from the same `columns`
 * spec, so what you see printed is what lands in the spreadsheet.
 * Disabled until the report has been run and returned rows.
 */
export default function ReportExportButtons<T>({
  rows,
  columns,
  meta,
  className,
  showPrint = true,
  showPreview = false,
}: ReportExportButtonsProps<T>) {
  const [busy, setBusy] = useState<null | "pdf" | "excel">(null);
  const empty = rows.length === 0;

  const handlePreview = () => {
    if (empty) return;
    previewReport(rows, columns, meta);
  };

  const handlePrint = () => {
    if (empty) return;
    printReport(rows, columns, meta);
  };

  const run = async (kind: "pdf" | "excel") => {
    if (empty) return;
    setBusy(kind);
    try {
      if (kind === "pdf") await exportPdf(rows, columns, meta);
      else await exportExcel(rows, columns, meta);
    } catch {
      toast.error(`Failed to export ${kind === "pdf" ? "PDF" : "Excel"}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {showPreview && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePreview}
          disabled={empty}
          title={empty ? "Run the report first" : "Preview"}
        >
          <Eye size={14} /> Preview
        </Button>
      )}
      {showPrint && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePrint}
          disabled={empty}
          title={empty ? "Run the report first" : "Print"}
        >
          <Printer size={14} /> Print
        </Button>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => run("pdf")}
        loading={busy === "pdf"}
        disabled={empty}
        title={empty ? "Run the report first" : "Download PDF"}
      >
        <FileText size={14} /> PDF
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => run("excel")}
        loading={busy === "excel"}
        disabled={empty}
        title={empty ? "Run the report first" : "Download Excel"}
      >
        <FileSpreadsheet size={14} /> Excel
      </Button>
    </div>
  );
}
