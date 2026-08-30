"use client";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { formatDate } from "@/lib/utils";
import { Eye, Printer } from "lucide-react";
import { type ExportColumn } from "@/lib/export/reportExport";
import {
  previewDeliveryChallan,
  printDeliveryChallan,
  challanItemName,
  sortChallanLines,
  type DeliveryChallanData,
  type DeliveryChallanLine,
} from "@/lib/export/deliveryChallanDocument";

/** A challan line, numbered. `Received Qty` and `Remarks` stay blank on every
 *  output — they are there for the receiving outlet to write in by hand. */
export interface ChallanRow extends DeliveryChallanLine { sl: number; }

/** Sorted and numbered exactly as {@link previewDeliveryChallan} renders them,
 *  so the on-screen table, the printed sheet and the spreadsheet agree row for row. */
export const challanRows = (lines: DeliveryChallanLine[]): ChallanRow[] =>
  sortChallanLines(lines).map((l, i) => ({ ...l, sl: i + 1 }));

// One spec behind the PDF and Excel exports; the printed/preview challan is
// rendered by deliveryChallanDocument from the same rows.
export const challanColumns: ExportColumn<ChallanRow>[] = [
  { header: "SL No", value: (r) => r.sl, numeric: true },
  { header: "Item Of Name", value: (r) => challanItemName(r), width: 34 },
  { header: "Delivery", value: (r) => r.qty, numeric: true },
  { header: "Received Qty", value: () => "", width: 14 },
  { header: "Remarks", value: () => "", width: 22 },
];

interface Props {
  /** The assembled document — see `useIssueChallan().savedChallan`. */
  challan: DeliveryChallanData;
  /** The Item_Issue serial, which is the record's identity rather than the
   *  challan number the outlet quotes back. */
  serialNo: string;
}

/**
 * The saved Stock Issue as its Delivery Challan: the document header, the
 * print / preview / export actions and the challan lines.
 *
 * Shared by the Stock Issue list and the full-page Item Issue screen, both of
 * which show it in a dialog once a document is saved or opened.
 */
export default function StockIssueChallanReport({ challan, serialNo }: Props) {
  const rows = challanRows(challan.items);
  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
        <div><span className="text-gray-500">Serial No:</span> <span className="font-medium">{serialNo}</span></div>
        <div><span className="text-gray-500">Challan No:</span> <span className="font-medium">{challan.challanNo || "-"}</span></div>
        <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(challan.issueDate)}</span></div>
        <div><span className="text-gray-500">From Branch:</span> <span className="font-medium">{challan.fromBranchName ?? "-"}</span></div>
        <div><span className="text-gray-500">To Branch:</span> <span className="font-medium">{challan.toBranchName ?? "-"}</span></div>
      </div>

      <div className="mb-3 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => previewDeliveryChallan(challan)}>
          <Eye size={14} /> Preview
        </Button>
        <Button variant="secondary" size="sm" onClick={() => printDeliveryChallan(challan)}>
          <Printer size={14} /> Print
        </Button>
        <ReportExportButtons
          rows={rows}
          columns={challanColumns}
          meta={{
            title: "Delivery Challan",
            subtitle: [challan.toBranchName, `Challan No: ${challan.challanNo || "-"}`, `Date: ${formatDate(challan.issueDate)}`].join(" · "),
            footer: ["", "", totalQty.toFixed(2), "", ""],
          }}
          showPrint={false}
        />
      </div>

      <Table
        data={rows.map((r) => ({ id: r.sl, ...r }))}
        columns={[
          { key: "sl", header: "SL No", className: "text-center w-16" },
          { key: "itemName", header: "Item Of Name", render: (r) => challanItemName(r) },
          { key: "qty", header: "Delivery", className: "text-right", render: (r) => r.qty.toFixed(2) },
          { key: "received", header: "Received Qty", render: () => "" },
          { key: "remarks", header: "Remarks", render: () => "" },
        ]}
      />
      <div className="mt-2 pr-4 text-right text-sm font-semibold text-gray-700">
        Total Delivery: {totalQty.toFixed(2)}
      </div>
    </>
  );
}
