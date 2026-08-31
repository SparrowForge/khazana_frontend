"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import {
  fetchItems, fetchBranches, fetchTransfers, fetchTransfer, transferStock, updateTransfer, deleteTransfer,
  type AvailableItem, type BranchOption, type TransferRecord, type TransferGroup,
} from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { previewReport, type ExportColumn } from "@/lib/export/reportExport";

interface TransferLine { itemId: string; qty: string; }

const reportColumns: ExportColumn<{ itemName?: string; qty: number }>[] = [
  { header: "Item Name", value: (r) => r.itemName ?? "-" },
  { header: "Qty", value: (r) => r.qty, numeric: true },
];

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

export default function StockTransferPage() {
  const { can } = usePermissions();
  const canAdd = can("StockTransfer", "add");
  const canEdit = can("StockTransfer", "edit");
  const canDelete = can("StockTransfer", "delete");

  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);
  const [filterBranchId, setFilterBranchId] = useState("");

  const [modal, setModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<TransferGroup | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [issueBranchId, setIssueBranchId] = useState("");
  const [receiveBranchId, setReceiveBranchId] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([{ itemId: "", qty: "1" }]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.branchName ?? "-";

  /** A transfer doesn't consume Inventory (the table is keyed by item alone, with
   *  no branch dimension, so moving units between branches nets to zero) — but it
   *  still can't ship units that don't exist anywhere, so lines are measured
   *  against whole-company on-hand. Nothing is added back when editing, for the
   *  same reason: the saved version never took anything out. */
  const availableFor = (itemId: string) =>
    availableItems.find((it) => it.id === itemId)?.stock ?? 0;

  const itemLabel = (it: AvailableItem) => {
    const available = availableFor(it.id);
    return `${it.itmCode} — ${it.itmName}${available > 0 ? ` (stock: ${available})` : " (out of stock)"}`;
  };

  /** Lines asking for more than exists, summed per item so the same item entered
   *  on two lines is measured against one balance. */
  const stockShortages = (rows: { itemId: string; qty: number }[]) => {
    const wanted: Record<string, number> = {};
    for (const r of rows) wanted[r.itemId] = (wanted[r.itemId] ?? 0) + r.qty;
    return Object.entries(wanted)
      .map(([itemId, qty]) => {
        const meta = availableItems.find((it) => it.id === itemId);
        return { name: meta?.itmName || meta?.itmCode || itemId, qty, available: availableFor(itemId) };
      })
      .filter((r) => r.qty > r.available);
  };

  const loadList = () => {
    setListLoading(true);
    fetchTransfers({ page, limit, fromDate, toDate, branchId: filterBranchId || undefined })
      .then(({ items, meta }) => { setTransfers(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchBranches().then(setBranches).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate, filterBranchId]);

  const addLine = () => setLines([...lines, { itemId: "", qty: "1" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof TransferLine, val: string) =>
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const openCreate = () => {
    setEditingSerial(null);
    setSerialNo("");
    setVoucherNo("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setIssueBranchId("");
    setReceiveBranchId("");
    setLines([{ itemId: "", qty: "1" }]);
    setModal(true);
  };

  const openEdit = async (record: TransferRecord) => {
    try {
      const full = await fetchTransfer(record.serialNo);
      setEditingSerial(full.serialNo);
      setSerialNo(full.serialNo);
      setVoucherNo(full.voucherNo ?? "");
      setIssueDate(full.issueDate ? full.issueDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      setIssueBranchId(full.issueBranchId ?? "");
      setReceiveBranchId(full.receiveBranchId ?? "");
      setLines(full.items.map((it) => ({ itemId: it.itemId, qty: String(it.qty ?? 1) })));
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load transfer record")); }
  };

  const openReport = async (record: TransferRecord) => {
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      const full = await fetchTransfer(record.serialNo);
      setReport(full);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load transfer report"));
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handleDelete = async (record: TransferRecord) => {
    if (!confirm(`Delete stock transfer "${record.serialNo}"?`)) return;
    try {
      await deleteTransfer(record.serialNo);
      toast.success("Stock transfer deleted");
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSubmit = async () => {
    if (!issueBranchId || !receiveBranchId) { toast.error("Select both branches"); return; }
    const valid = lines.filter((l) => l.itemId && parseFloat(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one item"); return; }
    const short = stockShortages(valid.map((l) => ({ itemId: l.itemId, qty: parseFloat(l.qty) })));
    if (short.length) {
      toast.error(`Not enough stock: ${short.map((s) => `${s.name} (${s.available} available, ${s.qty} requested)`).join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      if (editingSerial) {
        await updateTransfer(editingSerial, {
          voucherNo, issueDate, issueBranchId, receiveBranchId,
          items: valid.map((l) => ({ itemId: l.itemId, qty: parseFloat(l.qty) })),
        });
        toast.success("Stock transfer updated");
      } else {
        await transferStock({
          voucherNo, issueDate, issueBranchId, receiveBranchId,
          items: valid.map((l) => ({ itemId: l.itemId, qty: parseFloat(l.qty) })),
        });
        toast.success("Stock transfer saved");
      }
      setModal(false);
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, `Failed to ${editingSerial ? "update" : "save"}`)); } finally { setSubmitting(false); }
  };

  const handlePreview = () => {
    const valid = lines.filter((l) => l.itemId && parseFloat(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one valid line to preview"); return; }
    const rows = valid.map((l) => ({
      itemName: availableItems.find((it) => it.id === l.itemId)?.itmName,
      qty: parseFloat(l.qty),
    }));
    previewReport(rows, reportColumns, {
      title: "Stock Transfer Preview",
      subtitle: [
        `Serial No: ${editingSerial || "New"}`,
        `Voucher No: ${voucherNo || "-"}`,
        `Date: ${formatDate(issueDate)}`,
        `From: ${branchName(issueBranchId)}`,
        `To: ${branchName(receiveBranchId)}`,
      ].join(" · "),
    });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Stock Transfer"
        subtitle="Transfer stock between branches"
        action={canAdd ? { label: "New Transfer", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
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
      <Table loading={listLoading} data={transfers}
        columns={[
          { key: "issueDate", header: "Date", render: (r) => formatDate(r.issueDate) },
          {
            key: "serialNo", header: "Serial No",
            render: (r) => r.serialNo ? (
              <button onClick={() => openReport(r)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ) : "-",
          },
          { key: "qty", header: "Total Qty", className: "text-right" },
          { key: "issueBranchId", header: "From Branch", render: (r) => branchName(r.issueBranchId) },
          { key: "receiveBranchId", header: "To Branch", render: (r) => branchName(r.receiveBranchId) },
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingSerial ? "Edit Stock Transfer" : "New Transfer"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-5">
          {editingSerial && <Input label="Serial No" value={serialNo} disabled readOnly />}
          <Input label="Voucher No" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
          <Input label="Date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <Select label="From Branch" value={issueBranchId} onChange={(e) => setIssueBranchId(e.target.value)}
            placeholder="Select branch..." options={branches.map((b) => ({ value: b.id, label: b.branchName }))} />
          <Select label="To Branch" value={receiveBranchId} onChange={(e) => setReceiveBranchId(e.target.value)}
            placeholder="Select branch..." options={branches.map((b) => ({ value: b.id, label: b.branchName }))} />
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Select
                label={i === 0 ? "Item" : undefined}
                value={line.itemId}
                onChange={(e) => updateLine(i, "itemId", e.target.value)}
                placeholder="Select item..."
                options={availableItems.map((it) => ({
                  value: it.id,
                  label: itemLabel(it),
                  disabled: availableFor(it.id) <= 0,
                }))}
                className="flex-1"
              />
              <div className="w-28">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block">Qty</label>}
                <input type="number" min="1" step="1" value={line.qty} onChange={(e) => updateLine(i, "qty", e.target.value)}
                  className="w-full border border-sage-400 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              </div>
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 pb-2"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handlePreview}>Preview</Button>
          <Button onClick={handleSubmit} loading={submitting}>{editingSerial ? "Update Transfer" : "Save Transfer"}</Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Stock Transfer Report" size="lg">
        {reportLoading || !report ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
              <div><span className="text-gray-500">Serial No:</span> <span className="font-medium">{report.serialNo}</span></div>
              <div><span className="text-gray-500">Voucher No:</span> <span className="font-medium">{report.voucherNo || "-"}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(report.issueDate)}</span></div>
              <div><span className="text-gray-500">From Branch:</span> <span className="font-medium">{branchName(report.issueBranchId)}</span></div>
              <div><span className="text-gray-500">To Branch:</span> <span className="font-medium">{branchName(report.receiveBranchId)}</span></div>
            </div>
            <div className="mb-3 flex justify-end">
              <ReportExportButtons
                rows={report.items}
                columns={reportColumns}
                meta={{
                  title: "Stock Transfer Report",
                  subtitle: [
                    `Serial No: ${report.serialNo}`,
                    `Voucher No: ${report.voucherNo || "-"}`,
                    `Date: ${formatDate(report.issueDate)}`,
                    `From: ${branchName(report.issueBranchId)}`,
                    `To: ${branchName(report.receiveBranchId)}`,
                  ].join(" · "),
                  forcePortrait: true,
                }}
                showPreview
              />
            </div>
            <Table
              data={report.items.map((it, i) => ({ id: i, ...it }))}
              columns={[
                { key: "itemName", header: "Item Name", render: (r) => r.itemName ?? "-" },
                { key: "qty", header: "Qty", className: "text-right" },
              ]}
            />
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
