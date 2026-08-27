"use client";
import PosAdjustmentReportPage from "@/components/reports/PosAdjustmentReport";

// The Excess twin of Reports > Reject Report(POS) — same form, the other column
// of the same ItemReject row.
export default function ExcessReportPosPage() {
  return <PosAdjustmentReportPage kind="excess" />;
}
