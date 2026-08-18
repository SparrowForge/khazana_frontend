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
  fetchItems, fetchProductions, fetchProduction, createProduction, updateProduction, deleteProduction,
  vatInclusiveRate,
  type AvailableItem, type ProductionRecord, type ProductionGroup,
} from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { previewReport, type ExportColumn } from "@/lib/export/reportExport";

interface ProductionLine { itemId: string; qty: string; rate: string; }

/** Report/export rows. `rate` is VAT-inclusive, so amount is simply qty × rate
 *  — no VAT is added on top of it anywhere on this screen. */
interface ReportRow { itemName?: string; qty: number; rate: number; }

const reportColumns: ExportColumn<ReportRow>[] = [
  { header: "Item Name", value: (r) => r.itemName ?? "-" },
  { header: "Qty", value: (r) => r.qty, numeric: true },
  { header: "Rate (incl. VAT)", value: (r) => r.rate, numeric: true },
  { header: "Amount", value: (r) => r.qty * r.rate, numeric: true },
];

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

const emptyLine = (): ProductionLine => ({ itemId: "", qty: "1", rate: "0" });

const lineAmount = (l: ProductionLine) => (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0);

export default function ProductionEntryPage() {
  const { can } = usePermissions();
  const canAdd = can("ProductionEntry", "add");
  const canEdit = can("ProductionEntry", "edit");
  const canDelete = can("ProductionEntry", "delete");
  // Production always belongs to the session branch — which the sidebar and the
  // route guard have already established is the factory — so there is no branch
  // picker; the backend sets it from the token.
  const branchName = useAuthStore((s) => s.user?.branchName) ?? "Factory";

  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);

  const [modal, setModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<ProductionGroup | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<ProductionLine[]>([emptyLine()]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const itemLabel = (it: AvailableItem) => `${it.itmCode} — ${it.itmName} (stock: ${it.stock ?? 0})`;

  const formTotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);

  const loadList = () => {
    setListLoading(true);
    fetchProductions({ page, limit, fromDate, toDate })
      .then(({ items, meta }) => { setRecords(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
  }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate]);

  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof ProductionLine, val: string) =>
    setLines(lines.map((l, idx) => {
      if (idx !== i) return l;
      // Picking an item pre-fills the rate with its VAT-INCLUSIVE price; it stays
      // editable because a production rate is a costing decision, not the sale price.
      if (field === "itemId") {
        const item = availableItems.find((it) => it.id === val);
        return { ...l, itemId: val, rate: String(vatInclusiveRate(item)) };
      }
      return { ...l, [field]: val };
    }));

  const openCreate = () => {
    setEditingSerial(null);
    setSerialNo("");
    setProductionDate(new Date().toISOString().split("T")[0]);
    setRemarks("");
    setLines([emptyLine()]);
    setModal(true);
  };

  const openEdit = async (record: ProductionRecord) => {
    try {
      const full = await fetchProduction(record.serialNo);
      setEditingSerial(full.serialNo);
      setSerialNo(full.serialNo);
      setProductionDate(full.productionDate ? full.productionDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      setRemarks(full.remarks ?? "");
      setLines(full.items.map((it) => ({ itemId: it.itemId, qty: String(it.qty ?? 1), rate: String(it.rate ?? 0) })));
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load production entry")); }
  };

  const openReport = async (record: ProductionRecord) => {
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      setReport(await fetchProduction(record.serialNo));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load production report"));
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handleDelete = async (record: ProductionRecord) => {
    if (!confirm(`Delete production entry "${record.serialNo}"? The stock it added will be removed.`)) return;
    try {
      await deleteProduction(record.serialNo);
      toast.success("Production entry deleted");
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSubmit = async () => {
    const valid = lines.filter((l) => l.itemId && parseFloat(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one valid line"); return; }
    const payload = {
      productionDate,
      remarks,
      items: valid.map((l) => ({ itemId: l.itemId, qty: parseFloat(l.qty), rate: parseFloat(l.rate || "0") })),
    };
    setSubmitting(true);
    try {
      if (editingSerial) {
        await updateProduction(editingSerial, payload);
        toast.success("Production entry updated");
      } else {
        await createProduction(payload);
        toast.success("Production entry saved");
      }
      setModal(false);
      loadList();
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${editingSerial ? "update" : "save"}`));
    } finally { setSubmitting(false); }
  };

  const reportSubtitle = (serial: string, date?: string, note?: string) =>
    [`Serial No: ${serial}`, `Date: ${formatDate(date)}`, `Branch: ${branchName}`, `Remarks: ${note || "-"}`].join(" · ");

  const handlePreview = () => {
    const valid = lines.filter((l) => l.itemId && parseFloat(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one valid line to preview"); return; }
    const rows: ReportRow[] = valid.map((l) => ({
      itemName: availableItems.find((it) => it.id === l.itemId)?.itmName,
      qty: parseFloat(l.qty),
      rate: parseFloat(l.rate || "0"),
    }));
    previewReport(rows, reportColumns, {
      title: "Production Entry Preview",
      subtitle: reportSubtitle(editingSerial || "New", productionDate, remarks),
    });
  };

  const reportRows: ReportRow[] = (report?.items ?? []).map((it) => ({
    itemName: it.itemName,
    qty: it.qty,
    rate: it.rate ?? 0,
  }));
  const reportTotal = reportRows.reduce((sum, r) => sum + r.qty * r.rate, 0);

  return (
    <AppLayout>
      <PageHeader
        title="Production Entry"
        subtitle={`Record manufactured output at ${branchName} — adds to stock`}
        action={canAdd ? { label: "New Production", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />
      <div className="mb-4 flex gap-4 items-end">
        <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>
      <Table loading={listLoading} data={records}
        columns={[
          {
            key: "serialNo", header: "Serial No",
            render: (r) => r.serialNo ? (
              <button onClick={() => openReport(r)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ) : "-",
          },
          { key: "qty", header: "Total Qty", className: "text-right" },
          { key: "totalValue", header: "Total Value", className: "text-right", render: (r) => formatCurrency(r.totalValue) },
          { key: "productionDate", header: "Date", render: (r) => formatDate(r.productionDate) },
          { key: "remarks", header: "Remarks", render: (r) => r.remarks || "-" },
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingSerial ? "Edit Production Entry" : "New Production"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-5">
          {editingSerial && <Input label="Serial No" value={serialNo} disabled readOnly />}
          <Input label="Production Date" type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
          <Input label="Branch" value={branchName} disabled readOnly />
          <Input label="Remarks" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Select
                label={i === 0 ? "Item" : undefined}
                value={line.itemId}
                onChange={(e) => updateLine(i, "itemId", e.target.value)}
                placeholder="Select item..."
                options={availableItems.map((it) => ({ value: it.id, label: itemLabel(it) }))}
                className="flex-1"
              />
              <div className="w-24">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block">Qty</label>}
                <input type="number" min="0" step="0.01" value={line.qty} onChange={(e) => updateLine(i, "qty", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              </div>
              <div className="w-32">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block">Rate (incl. VAT)</label>}
                <input type="number" min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(i, "rate", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              </div>
              <div className="w-28 text-right pb-2 text-sm text-gray-700">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block text-right">Amount</label>}
                {formatCurrency(lineAmount(line))}
              </div>
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 pb-2"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
        </div>
        <div className="mt-4 flex justify-end text-sm font-medium text-gray-700">
          Total (incl. VAT): <span className="ml-2 w-28 text-right">{formatCurrency(formTotal)}</span>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handlePreview}>Preview</Button>
          <Button onClick={handleSubmit} loading={submitting}>{editingSerial ? "Update Production" : "Save Production"}</Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Production Entry Report" size="lg">
        {reportLoading || !report ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
              <div><span className="text-gray-500">Serial No:</span> <span className="font-medium">{report.serialNo}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(report.productionDate)}</span></div>
              <div><span className="text-gray-500">Branch:</span> <span className="font-medium">{branchName}</span></div>
              <div><span className="text-gray-500">Remarks:</span> <span className="font-medium">{report.remarks || "-"}</span></div>
            </div>
            <div className="mb-3 flex justify-end">
              <ReportExportButtons
                rows={reportRows}
                columns={reportColumns}
                meta={{
                  title: "Production Entry Report",
                  subtitle: reportSubtitle(report.serialNo, report.productionDate, report.remarks),
                }}
                showPreview
              />
            </div>
            <Table
              data={reportRows.map((it, i) => ({ id: i, ...it }))}
              columns={[
                { key: "itemName", header: "Item Name", render: (r) => r.itemName ?? "-" },
                { key: "qty", header: "Qty", className: "text-right" },
                { key: "rate", header: "Rate (incl. VAT)", className: "text-right", render: (r) => r.rate.toFixed(2) },
                { key: "amount", header: "Amount", className: "text-right", render: (r) => formatCurrency(r.qty * r.rate) },
              ]}
            />
            <div className="mt-3 flex justify-end text-sm font-medium text-gray-700">
              Total (incl. VAT): <span className="ml-2">{formatCurrency(reportTotal)}</span>
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
