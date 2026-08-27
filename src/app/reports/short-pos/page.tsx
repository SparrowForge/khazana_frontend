"use client";
import PosAdjustmentReportPage from "@/components/reports/PosAdjustmentReport";

// The Short twin of Reports > Reject Report(POS) — same form, the third column
// of the same ItemReject row.
export default function ShortReportPosPage() {
  return <PosAdjustmentReportPage kind="short" />;
}
