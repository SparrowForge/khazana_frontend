"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import { fetchStockReport, type StockRow, type StockReport } from "./server";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import type { ExportColumn } from "@/lib/export/reportExport";

const exportColumns: ExportColumn<StockRow>[] = [
  { header: "Item Code", value: (r) => r.itemCode ?? "" },
  { header: "Item Name", value: (r) => r.itemName ?? "", width: 30 },
  { header: "UOM", value: (r) => r.uom ?? "" },
  { header: "Opening", value: (r) => r.openingQty ?? 0, numeric: true },
  { header: "In", value: (r) => r.inwardQty ?? 0, numeric: true },
  { header: "Out", value: (r) => r.outwardQty ?? 0, numeric: true },
  { header: "Closing", value: (r) => r.closingQty ?? 0, numeric: true },
];

export default function StockReportPage() {
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  // Seeded with the branch the user logged in at; "All Branch" combines every
  // branch, which is the company-wide position this report used to show.
  const [branchId, setBranchId] = useState("");
  const [report, setReport] = useState<StockReport | null>(null);
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
    fetchStockReport(fromDate || undefined, toDate || undefined, branchId || undefined)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        toast.error(getErrorMessage(err, "Failed to load the report"));
      })
      .finally(() => setLoading(false));
  };

  const subtitle = useMemo(() => {
    const period =
      !report?.fromDate && !report?.toDate
        ? `As at ${formatDate(new Date())}`
        : `${report?.fromDate ? formatDate(report.fromDate) : "Beginning"} → ${
            report?.toDate ? formatDate(report.toDate) : formatDate(new Date())
          }`;
    return [report?.branch.name, period].filter(Boolean).join(" · ");
  }, [report]);

  return (
    <AppLayout>
      <PageHeader
        title="Stock Report"
        subtitle="Opening, in, out and closing per item — for one branch"
      />

      <div className="mb-5 p-4 bg-white rounded-lg border border-sage-300 flex flex-wrap items-end gap-3">
        {/* Both dates are optional: no From means "since the beginning" (Opening
            is then zero), no To means "up to now". */}
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Branch Name"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          placeholder="All Branch"
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-56"
        />
        <Button onClick={runReport} loading={loading}>Run Report</Button>
        <ReportExportButtons
          className="ml-auto"
          rows={report?.items ?? []}
          columns={exportColumns}
          meta={{ title: "Stock Report", subtitle }}
        />
      </div>

      {report && (
        <p className="mb-3 text-sm text-primary-900">
          <span className="font-semibold">{report.branch.name}</span>
          <span className="text-gray-500"> · {subtitle.split(" · ").slice(1).join(" · ")}</span>
        </p>
      )}

      <Table
        loading={loading}
        data={report?.items ?? []}
        columns={[
          { key: "itemCode", header: "Item Code" },
          { key: "itemName", header: "Item Name" },
          { key: "uom", header: "UOM" },
          { key: "openingQty", header: "Opening", render: (r) => formatCurrency(r.openingQty ?? 0), className: "text-right" },
          { key: "inwardQty", header: "In", render: (r) => formatCurrency(r.inwardQty ?? 0), className: "text-right" },
          { key: "outwardQty", header: "Out", render: (r) => formatCurrency(r.outwardQty ?? 0), className: "text-right" },
          {
            key: "closingQty",
            header: "Closing",
            // A negative closing balance is a real shortage at that branch, so it
            // is called out rather than left to blend into the column.
            render: (r) => (
              <span className={(r.closingQty ?? 0) < 0 ? "text-red-600" : undefined}>
                {formatCurrency(r.closingQty ?? 0)}
              </span>
            ),
            className: "text-right font-semibold",
          },
        ]}
      />
    </AppLayout>
  );
}
