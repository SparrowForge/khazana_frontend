"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StockIssueForm from "@/components/inventory/StockIssueForm";
import StockIssueChallanReport from "@/components/inventory/StockIssueChallanReport";
import { useIssueChallan } from "@/components/inventory/useIssueChallan";
import {
  fetchIssues, fetchIssue, deleteIssue,
  type IssueRecord, type IssueGroup,
} from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

export default function StockIssuePage() {
  const { can } = usePermissions();
  const canAdd = can("StockIssue", "add");
  const canEdit = can("StockIssue", "edit");
  const canDelete = can("StockIssue", "delete");

  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);
  const [filterBranchId, setFilterBranchId] = useState("");

  const [modal, setModal] = useState(false);
  /** The document the dialog is editing; null while writing a new one. */
  const [editing, setEditing] = useState<IssueGroup | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<IssueGroup | null>(null);

  // Branch names, the letterhead and the challan builder — shared with the
  // entry form and the full-page Item Issue screen.
  const { branches, branchName, savedChallan } = useIssueChallan();

  const loadList = () => {
    setListLoading(true);
    fetchIssues({ page, limit, fromDate, toDate, branchId: filterBranchId || undefined })
      .then(({ items, meta }) => { setIssues(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate, filterBranchId]);

  const openCreate = () => { setEditing(null); setModal(true); };

  const openEdit = async (record: IssueRecord) => {
    try {
      setEditing(await fetchIssue(record.serialNo));
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load issue record")); }
  };

  const openReport = async (serialNo: string) => {
    if (!serialNo) return;
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      setReport(await fetchIssue(serialNo));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load issue report"));
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handleDelete = async (record: IssueRecord) => {
    if (!confirm(`Delete stock issue "${record.serialNo}"?`)) return;
    try {
      await deleteIssue(record.serialNo);
      toast.success("Stock issue deleted");
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  /** Saved from the dialog: close it, refresh the list and go straight to the
   *  Delivery Challan the outlet has to be sent with. */
  const handleSaved = (serialNo: string) => {
    setModal(false);
    loadList();
    openReport(serialNo);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Stock Issue"
        subtitle="Record outgoing stock"
        action={canAdd ? { label: "New Issue", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />
      <div className="mb-4 flex gap-4 items-end">
        <Input
          label="From Date"
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }}
        />
        <Input
          label="To Date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <Select
          label="Branch"
          value={filterBranchId}
          onChange={(e) => setFilterBranchId(e.target.value)}
          placeholder="All branches"
          options={[{ value: "", label: "All branches" }, ...branches.map((b) => ({ value: b.id, label: b.branchName }))]}
        />
      </div>
      <Table loading={listLoading} data={issues}
        columns={[
          { key: "issueDate", header: "Date", render: (r) => formatDate(r.issueDate) },
          {
            key: "serialNo", header: "Serial No",
            render: (r) => r.serialNo ? (
              <button onClick={() => openReport(r.serialNo)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ) : "-",
          },
          { key: "issueBranchId", header: "From Branch", render: (r) => branchName(r.issueBranchId) },
          { key: "receiveBranchId", header: "To Branch", render: (r) => branchName(r.receiveBranchId) },
          { key: "qty", header: "Total Qty", className: "text-right" },
          {
            key: "actions", header: "",
            render: (r) => (
              <div className="flex items-center gap-3">
                {canEdit && (
                  <button onClick={() => openEdit(r)} className="text-primary-800 hover:underline" title="Edit">
                    <Edit2 size={14} />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600" title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}

      {/* The same entry form the full-page Item Issue screen runs, laid out for
          a dialog. Rendered only while open, so it reads current stock each time. */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Stock Issue" : "New Issue"} size="lg">
        <StockIssueForm
          variant="modal"
          document={editing}
          onCancel={() => setModal(false)}
          onSaved={handleSaved}
        />
      </Modal>

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
