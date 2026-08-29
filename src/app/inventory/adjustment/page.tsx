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
  fetchItems, fetchAdjustments, fetchAdjustment, adjustStock, updateAdjustment, deleteAdjustment,
  type AvailableItem, type AdjustmentRecord, type AdjustmentGroup,
} from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { previewReport, type ExportColumn } from "@/lib/export/reportExport";

interface AdjLine { itmOId: string; reject: string; excess: string; short: string; assort: string; }

interface AdjReportRow { itemName?: string; reject: number; excess: number; short: number; assort: number; }

const reportColumns: ExportColumn<AdjReportRow>[] = [
  { header: "Item Name", value: (r) => r.itemName ?? "-" },
  { header: "Reject", value: (r) => r.reject, numeric: true },
  { header: "Excess", value: (r) => r.excess, numeric: true },
  { header: "Short", value: (r) => r.short, numeric: true },
  { header: "Assort", value: (r) => r.assort, numeric: true },
];

/** Header and line rows share one column template so a header always sits over
 *  the field it names: a wide Item column, four equal number columns, then an
 *  auto column for the delete button. The previous `grid-cols-6` had six header
 *  cells against seven row items, which pushed every header one column left of
 *  its input and squeezed the item picker down to a single column. */
const LINE_GRID = "grid grid-cols-[minmax(0,3fr)_repeat(4,minmax(0,1fr))_auto] gap-2";

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

export default function StockAdjustmentPage() {
  const { can } = usePermissions();
  const canAdd = can("StockAdjustment", "add");
  const canEdit = can("StockAdjustment", "edit");
  const canDelete = can("StockAdjustment", "delete");

  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);

  const [modal, setModal] = useState(false);
  const [editingInvNo, setEditingInvNo] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<AdjustmentGroup | null>(null);
  const [invNo, setInvNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<AdjLine[]>([{ itmOId: "", reject: "0", excess: "0", short: "0", assort: "0" }]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const itemLabel = (id?: string) => {
    const it = availableItems.find((a) => a.id === id);
    return it ? `${it.itmCode} — ${it.itmName}` : id || "-";
  };

  const loadList = () => {
    setListLoading(true);
    fetchAdjustments({ page, limit, fromDate, toDate })
      .then(({ items, meta }) => { setAdjustments(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate]);

  const addLine = () => setLines([...lines, { itmOId: "", reject: "0", excess: "0", short: "0", assort: "0" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof AdjLine, val: string) =>
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const openCreate = () => {
    setEditingInvNo(null);
    setInvNo("");
    setDate(new Date().toISOString().split("T")[0]);
    setLines([{ itmOId: "", reject: "0", excess: "0", short: "0", assort: "0" }]);
    setModal(true);
  };

  const openEdit = async (record: AdjustmentRecord) => {
    try {
      const full = await fetchAdjustment(record.invNo);
      setEditingInvNo(full.invNo);
      setInvNo(full.invNo);
      setDate(full.date ? full.date.split("T")[0] : new Date().toISOString().split("T")[0]);
      setLines(full.items.map((it) => ({
        itmOId: it.itmOId,
        reject: String(it.reject ?? 0),
        excess: String(it.excess ?? 0),
        short: String(it.short ?? 0),
        assort: String(it.assort ?? 0),
      })));
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load adjustment record")); }
  };

  const openReport = async (record: AdjustmentRecord) => {
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      const full = await fetchAdjustment(record.invNo);
      setReport(full);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load adjustment report"));
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handleDelete = async (record: AdjustmentRecord) => {
    if (!confirm(`Delete adjustment "${record.invNo}"?`)) return;
    try {
      await deleteAdjustment(record.invNo);
      toast.success("Adjustment deleted");
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSubmit = async () => {
    const valid = lines.filter((l) => l.itmOId);
    if (!valid.length) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      const items = valid.map((l) => ({
        itmOId: l.itmOId,
        reject: parseFloat(l.reject) || 0, excess: parseFloat(l.excess) || 0, short: parseFloat(l.short) || 0, assort: parseFloat(l.assort) || 0,
      }));
      if (editingInvNo) {
        await updateAdjustment(editingInvNo, { date, items });
        toast.success("Adjustment updated");
      } else {
        await adjustStock({ date, items });
        toast.success("Adjustment saved");
      }
      setModal(false);
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, `Failed to ${editingInvNo ? "update" : "save"}`)); } finally { setSubmitting(false); }
  };

  const handlePreview = () => {
    const valid = lines.filter((l) => l.itmOId);
    if (!valid.length) { toast.error("Add at least one item to preview"); return; }
    const rows: AdjReportRow[] = valid.map((l) => ({
      itemName: availableItems.find((it) => it.id === l.itmOId)?.itmName,
      reject: parseFloat(l.reject) || 0,
      excess: parseFloat(l.excess) || 0,
      short: parseFloat(l.short) || 0,
      assort: parseFloat(l.assort) || 0,
    }));
    previewReport(rows, reportColumns, {
      title: "Stock Adjustment Preview",
      subtitle: [
        `Reference No: ${editingInvNo || "New"}`,
        `Date: ${formatDate(date)}`,
      ].join(" · "),
    });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Stock Adjustment"
        subtitle="Record reject, excess, short, assort adjustments"
        action={canAdd ? { label: "New Adjustment", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />
      <div className="mb-4 flex gap-4 items-end">
        <Input
          label="From Date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <Input
          label="To Date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>
      <Table loading={listLoading} data={adjustments}
        columns={[
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          {
            key: "invNo", header: "Reference No",
            render: (r) => r.invNo ? (
              <button onClick={() => openReport(r)} className="text-primary-800 hover:underline font-medium">
                {r.invNo}
              </button>
            ) : "-",
          },
          { key: "reject", header: "Reject", className: "text-right" },
          { key: "excess", header: "Excess", className: "text-right" },
          { key: "short", header: "Short", className: "text-right" },
          { key: "assort", header: "Assort", className: "text-right" },
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingInvNo ? "Edit Adjustment" : "New Adjustment"} size="xl">
        <div className="grid grid-cols-2 gap-4 mb-5">
          {editingInvNo && <Input label="Reference No" value={invNo} disabled readOnly />}
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className={`${LINE_GRID} text-xs font-semibold text-gray-600 px-1`}>
            <span>Item</span><span>Reject</span><span>Excess</span><span>Short</span><span>Assort</span>
            {/* Empty cell over the delete button, so the five labels above stay
                aligned with their inputs. */}
            <span className="w-5" />
          </div>
          {lines.map((line, i) => (
            <div key={i} className={`${LINE_GRID} items-center`}>
              <Select
                searchable
                value={line.itmOId}
                onChange={(e) => updateLine(i, "itmOId", e.target.value)}
                placeholder="Select..."
                options={availableItems.map((it) => ({ value: it.id, label: `${it.itmCode} — ${it.itmName}` }))}
              />
              {(["reject", "excess", "short", "assort"] as const).map((f) => (
                <input key={f} type="number" min="0" step="0.01" value={line[f]}
                  onChange={(e) => updateLine(i, f, e.target.value)}
                  className="border border-sage-400 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              ))}
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handlePreview}>Preview</Button>
          <Button onClick={handleSubmit} loading={submitting}>{editingInvNo ? "Update Adjustment" : "Save Adjustment"}</Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Stock Adjustment Report" size="lg">
        {reportLoading || !report ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
              <div><span className="text-gray-500">Reference No:</span> <span className="font-medium">{report.invNo}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(report.date)}</span></div>
            </div>
            <div className="mb-3 flex justify-end">
              <ReportExportButtons
                rows={report.items}
                columns={reportColumns}
                meta={{
                  title: "Stock Adjustment Report",
                  subtitle: [
                    `Reference No: ${report.invNo}`,
                    `Date: ${formatDate(report.date)}`,
                  ].join(" · "),
                  forcePortrait: true,
                }}
                showPreview
              />
            </div>
            <Table
              data={report.items.map((it, i) => ({ id: i, ...it }))}
              columns={[
                { key: "itemName", header: "Item Name", render: (r) => r.itemName ?? itemLabel(r.itmOId) },
                { key: "reject", header: "Reject", className: "text-right" },
                { key: "excess", header: "Excess", className: "text-right" },
                { key: "short", header: "Short", className: "text-right" },
                { key: "assort", header: "Assort", className: "text-right" },
              ]}
            />
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
