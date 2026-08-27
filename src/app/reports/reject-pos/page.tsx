"use client";
import PosAdjustmentReportPage from "@/components/reports/PosAdjustmentReport";

// Reject and Excess print the same form from the same table; the shared
// component holds the one implementation. See Reports > Excess Report(POS).
export default function RejectReportPosPage() {
  return <PosAdjustmentReportPage kind="reject" />;
}
