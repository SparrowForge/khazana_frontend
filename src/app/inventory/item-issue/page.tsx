"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import StockIssueForm from "@/components/inventory/StockIssueForm";
import StockIssueChallanReport from "@/components/inventory/StockIssueChallanReport";
import { useIssueChallan } from "@/components/inventory/useIssueChallan";
import { fetchIssue, type IssueGroup } from "@/app/inventory/issue/server";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

/**
 * Item Issue — the Stock Issue entry form on a screen of its own, the way POS
 * Billing and Credit Sales get one, for the operator who does nothing but write
 * issues all day. The catalogue fills the height instead of a dialog's 45vh,
 * and the sheet stays open document after document.
 *
 * The list, edit and delete of past issues stay on Stock Issue — this screen
 * writes new ones. Both run the same {@link StockIssueForm}.
 */
export default function ItemIssuePage() {
  const { savedChallan } = useIssueChallan();
  /** The just-saved document, shown as its Delivery Challan. */
  const [report, setReport] = useState<IssueGroup | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  /** Straight to the Delivery Challan the receiving outlet has to be sent with —
   *  the form has already cleared itself for the next document behind it. */
  const showChallan = async (serialNo: string) => {
    if (!serialNo) return;
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      setReport(await fetchIssue(serialNo));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load the challan"));
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Item Issue" subtitle="Issue stock to a branch — full screen entry" />

      <StockIssueForm variant="page" onSaved={showChallan} />

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Stock Issue Report" size="lg">
        {reportLoading || !report ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          <StockIssueChallanReport challan={savedChallan(report)} serialNo={report.serialNo} />
        )}
      </Modal>
    </AppLayout>
  );
}
