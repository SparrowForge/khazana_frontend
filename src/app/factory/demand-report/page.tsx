"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { useAuthStore } from "@/store/auth.store";
import {
  fetchDemandReport, createDemandReportShare, demandReportShareUrl,
  type DemandReport, type DemandReportRow,
} from "./server";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import { DEMAND_ORDER_TYPES, demandTypeLabel } from "@/app/orders/demand/server";
import DemandReportSheet, { DemandReportPrintStyles, periodLabel } from "@/components/reports/DemandReportSheet";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Link2, Check } from "lucide-react";
import type { ExportColumn } from "@/lib/export/reportExport";

export default function DemandReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Who raised the demand — empty means every branch, one column each.
  const [fromBranchId, setFromBranchId] = useState("");
  // Who it was raised on — the factory, i.e. the branch the user is logged in at.
  const [toBranchId, setToBranchId] = useState("");
  /** Demand round; blank = every round. */
  const [orderType, setOrderType] = useState("");
  const [report, setReport] = useState<DemandReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    fetchBranches({ page: 1, limit: 100 })
      // Already in Branch.sortingNo order — /admin/branches sorts by it, which
      // is the same order the report's own columns come back in.
      .then(({ items }) => setBranches(items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionBranchId) setToBranchId((b) => b || sessionBranchId);
  }, [sessionBranchId]);

  const runReport = () => {
    setLoading(true);
    fetchDemandReport(fromDate, toDate, fromBranchId || undefined, toBranchId || undefined, orderType || undefined)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        toast.error(getErrorMessage(err, "Failed to load the report"));
      })
      .finally(() => setLoading(false));
  };

  /**
   * Mints a public link for the run that is on screen and hands it off.
   *
   * `navigator.share` first where the OS offers it, clipboard otherwise — the
   * same hand-off the credit-sale invoice uses. The link carries no login and
   * cannot be revoked, so the toast says so rather than leaving staff to assume
   * it is internal.
   */
  const shareReport = async () => {
    if (!report) return;
    setSharing(true);
    try {
      const { token } = await createDemandReportShare({
        fromDate, toDate,
        fromBranchId: fromBranchId || undefined,
        toBranchId: toBranchId || undefined,
        orderType: orderType || undefined,
      });
      const url = demandReportShareUrl(token);
      const text = `Demand Report — ${periodLabel(fromDate, toDate)}`;
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: text, text, url });
          return;
        } catch {
          // Cancelled, or the OS sheet refused — fall through to the clipboard.
        }
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      toast.success("Public link copied — anyone with it can view this report");
      setTimeout(() => setShared(false), 2500);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not create the share link"));
    } finally {
      setSharing(false);
    }
  };

  // Branch columns are only known once the report has run, so the export spec
  // is built from what came back rather than declared up front.
  const exportColumns = useMemo<ExportColumn<DemandReportRow>[]>(() => {
    const cols = report?.branches ?? [];
    return [
      { header: "SL", value: (r) => r.sl, numeric: true },
      { header: "Item Name", value: (r) => r.itemName, width: 30 },
      { header: "Rate", value: (r) => r.rate, numeric: true },
      ...cols.map((b) => ({
        header: b.code || b.name,
        value: (r: DemandReportRow) => r.qtyByBranch[b.id] ?? 0,
        numeric: true,
      })),
      { header: "Total Qty", value: (r) => r.totalQty, numeric: true },
    ];
  }, [report]);

  // The round is named on the exported/printed sheet too — a filtered run and
  // an unfiltered one are different documents and must not read alike.
  const subtitle = useMemo(
    () =>
      [
        report?.fromBranch.name,
        report?.toBranch.name,
        report?.orderType ? demandTypeLabel(report.orderType) : "",
        periodLabel(fromDate, toDate),
      ]
        .filter(Boolean)
        .join(" · "),
    [report, fromDate, toDate],
  );

  return (
    <AppLayout>
      <PageHeader title="Demand Report" subtitle="Branch demands for a date, one column per branch" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }} className="w-40" />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Demand From Branch"
          value={fromBranchId}
          onChange={(e) => setFromBranchId(e.target.value)}
          placeholder="All Branch"
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-48"
        />
        <Select
          label="Demand To Branch"
          value={toBranchId}
          onChange={(e) => setToBranchId(e.target.value)}
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-48"
        />
        <Select
          label="Order Type"
          value={orderType}
          onChange={(e) => setOrderType(e.target.value)}
          placeholder="All Types"
          options={DEMAND_ORDER_TYPES}
          className="w-40"
        />
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>}
        {/* Only once a report is on screen — there is nothing to share before. */}
        {report && (
          <Button
            variant="secondary"
            onClick={shareReport}
            loading={sharing}
            className="mb-0.5"
            title="Create a public link to this report — anyone holding it can view it, with no login"
          >
            {shared ? <Check size={15} /> : <Link2 size={15} />}
            {shared ? "Copied" : "Public Share"}
          </Button>
        )}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={report?.items ?? []}
          columns={exportColumns}
          meta={{ title: "Demand Report", subtitle }}
        />
      </div>

      {report && (
        <>
          <DemandReportPrintStyles />
          <DemandReportSheet data={report} />
        </>
      )}
    </AppLayout>
  );
}
