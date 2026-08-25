"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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

/** What the user typed against one item in the entry grid. The grid lists the
 *  whole catalogue, so most items carry an empty `qty` and are simply skipped —
 *  only rows with qty > 0 are ever sent. `rate` is seeded from the item's
 *  VAT-inclusive price and stays editable: a production rate is a costing
 *  decision, not the sale price. */
interface ItemEntry { qty: string; rate: string; }

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

const entryAmount = (e: ItemEntry) => (parseFloat(e.qty) || 0) * (parseFloat(e.rate) || 0);

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
  /** Keyed by item id. Absent = untouched, which is the same as qty 0. */
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  /** An untouched row still shows the item's own VAT-inclusive price, so the
   *  grid reads as a rate sheet the user only has to type quantities into. */
  const entryFor = (it: AvailableItem): ItemEntry =>
    entries[it.id] ?? { qty: "", rate: String(vatInclusiveRate(it)) };

  const setEntry = (it: AvailableItem, patch: Partial<ItemEntry>) =>
    setEntries((prev) => ({ ...prev, [it.id]: { ...entryFor(it), ...patch } }));

  /** The lines that will actually be saved: qty > 0, in catalogue order. */
  const validLines = useMemo(
    () =>
      availableItems
        .filter((it) => parseFloat(entries[it.id]?.qty ?? "") > 0)
        .map((it) => {
          const entry = entries[it.id];
          return {
            itemId: it.id,
            itemName: it.itmName,
            qty: parseFloat(entry.qty),
            // A row the user never edited the rate on falls back to the item's
            // own price rather than saving a zero-value production line.
            rate: parseFloat(entry.rate || "") || vatInclusiveRate(it),
          };
        }),
    [availableItems, entries],
  );

  const formTotal = validLines.reduce((sum, l) => sum + l.qty * l.rate, 0);

  /** The grid shows every item; a catalogue of any size needs a filter. Rows
   *  already carrying a qty stay visible so a search can't hide pending input. */
  const visibleItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return availableItems;
    return availableItems.filter(
      (it) =>
        parseFloat(entries[it.id]?.qty ?? "") > 0 ||
        it.itmCode?.toLowerCase().includes(q) ||
        it.itmName?.toLowerCase().includes(q),
    );
  }, [availableItems, entries, itemSearch]);

  const openCreate = () => {
    setEditingSerial(null);
    setSerialNo("");
    setProductionDate(new Date().toISOString().split("T")[0]);
    setRemarks("");
    setEntries({});
    setItemSearch("");
    setModal(true);
  };

  const openEdit = async (record: ProductionRecord) => {
    try {
      const full = await fetchProduction(record.serialNo);
      setEditingSerial(full.serialNo);
      setSerialNo(full.serialNo);
      setProductionDate(full.productionDate ? full.productionDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      setRemarks(full.remarks ?? "");
      setItemSearch("");
      // Repeated lines of one item collapse into the grid's single row for it;
      // the last rate saved for that item wins.
      setEntries(
        full.items.reduce<Record<string, ItemEntry>>((acc, it) => {
          const previous = parseFloat(acc[it.itemId]?.qty ?? "0") || 0;
          acc[it.itemId] = {
            qty: String(previous + Number(it.qty ?? 0)),
            rate: String(it.rate ?? 0),
          };
          return acc;
        }, {}),
      );
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
    if (!validLines.length) { toast.error("Enter a quantity on at least one item"); return; }
    const payload = {
      productionDate,
      remarks,
      items: validLines.map((l) => ({ itemId: l.itemId, qty: l.qty, rate: l.rate })),
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
    if (!validLines.length) { toast.error("Enter a quantity on at least one item to preview"); return; }
    const rows: ReportRow[] = validLines.map((l) => ({ itemName: l.itemName, qty: l.qty, rate: l.rate }));
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
        <div className="flex items-center justify-between gap-3 mb-2">
          <Input
            placeholder="Search items by code or name..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="w-72"
          />
          <div className="text-sm text-gray-500">
            {validLines.length} item{validLines.length === 1 ? "" : "s"} to produce
          </div>
        </div>

        {/* The whole catalogue, with the quantity typed inline — same sheet as
            Stock Receive / Stock Issue. Scrolls rather than paginates so a
            part-filled sheet is never split across pages. Only rows carrying a
            quantity are saved. */}
        <div className="border border-sage-300 rounded-lg overflow-auto max-h-[45vh]">
          <table className="w-full text-sm">
            <thead className="bg-sage-100 sticky top-0 z-10">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Item ID</th>
                <th className="px-3 py-2 font-medium">Item Name</th>
                <th className="px-3 py-2 font-medium text-right">Current Stock</th>
                <th className="px-3 py-2 font-medium text-right w-28">Qty</th>
                <th className="px-3 py-2 font-medium text-right w-32">Rate (incl. VAT)</th>
                <th className="px-3 py-2 font-medium text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const entry = entryFor(it);
                const qty = parseFloat(entry.qty) || 0;
                return (
                  <tr key={it.id} className={`border-t border-sage-200 ${qty > 0 ? "bg-primary-50/40" : ""}`}>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{it.itmCode}</td>
                    <td className="px-3 py-1.5">{it.itmName}</td>
                    {/* Context only — production adds stock, so nothing to cap. */}
                    <td className="px-3 py-1.5 text-right text-gray-500">{it.stock ?? 0}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.qty}
                        placeholder="0"
                        onChange={(e) => setEntry(it, { qty: e.target.value })}
                        className="w-full border border-sage-400 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.rate}
                        onChange={(e) => setEntry(it, { rate: e.target.value })}
                        className="w-full border border-sage-400 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-700 whitespace-nowrap">
                      {formatCurrency(entryAmount(entry))}
                    </td>
                  </tr>
                );
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                    No items match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end text-sm font-medium text-gray-700">
          Total (incl. VAT): <span className="ml-2 w-28 text-right">{formatCurrency(formTotal)}</span>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handlePreview} disabled={!validLines.length}>Preview</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!validLines.length}>
            {editingSerial ? "Update Production" : "Save Production"}
          </Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Production Entry Report" size="lg">
        {reportLoading || !report ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          <>
            {/* Branch header */}
            <div className="mb-4 pb-4 border-b border-sage-300">
              <h3 className="text-lg font-semibold text-gray-900">{report.branchName || branchName}</h3>
              {report.branchAddress && <p className="text-sm text-gray-600">{report.branchAddress}</p>}
            </div>

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
                  subtitle: [
                    report.branchName || branchName,
                    `Serial No: ${report.serialNo}`,
                    `Date: ${formatDate(report.productionDate)}`,
                  ].join(" · "),
                  forcePortrait: true,
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
