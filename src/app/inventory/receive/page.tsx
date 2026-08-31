"use client";
import { useEffect, useMemo, useState } from "react";
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
  fetchItems, fetchBranches, fetchReceives, fetchReceive, receiveStock, updateReceive, deleteReceive,
  fetchPendingReceives, fetchPendingReceive, confirmReceive,
  type AvailableItem, type BranchOption, type ReceiveRecord, type ReceiveGroup,
  type PendingReceive, type PendingReceiveDetail,
} from "./server";
import { fetchSettings, type Settings } from "@/app/admin/settings/server";
import { useAuthStore } from "@/store/auth.store";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2, Eye, Printer } from "lucide-react";
import { previewReport, type ExportColumn } from "@/lib/export/reportExport";
import {
  previewGoodsReceivedNote,
  printGoodsReceivedNote,
  challanItemName,
  sortChallanLines,
  type DeliveryChallanData,
  type DeliveryChallanLine,
} from "@/lib/export/deliveryChallanDocument";

/** What the user typed against one item in the entry grid. The grid lists the
 *  whole catalogue, so most items carry an empty `qty` and are simply skipped —
 *  only rows with qty > 0 are ever sent. */
interface ItemEntry { qty: string; }

const BLANK_ENTRY: ItemEntry = { qty: "" };

const reportColumns: ExportColumn<{ itemName?: string; qty: number }>[] = [
  { header: "Item Name", value: (r) => r.itemName ?? "-" },
  { header: "Qty", value: (r) => r.qty, numeric: true },
];

/** A Goods Received Note line, numbered. `Remarks` prints blank — it is there
 *  for the store keeper to write in by hand. */
interface NoteRow extends DeliveryChallanLine { sl: number; }

/** Sorted and numbered exactly as the printed pad renders them, so the
 *  on-screen table, the sheet and the spreadsheet agree row for row. */
const challanRows = (lines: DeliveryChallanLine[]): NoteRow[] =>
  sortChallanLines(lines).map((l, i) => ({ ...l, sl: i + 1 }));

// One spec behind the PDF and Excel exports; the printed/preview pad is
// rendered by deliveryChallanDocument from the same rows.
const noteColumns: ExportColumn<NoteRow>[] = [
  { header: "SL No", value: (r) => r.sl, numeric: true },
  { header: "Item Of Name", value: (r) => challanItemName(r), width: 34 },
  { header: "Received Qty", value: (r) => r.qty, numeric: true },
  { header: "Remarks", value: () => "", width: 22 },
];

const getDefaultDateRange = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: firstOfMonth.toISOString().split("T")[0],
    toDate: today.toISOString().split("T")[0],
  };
};

export default function StockReceivePage() {
  const user = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const canAdd = can("StockReceive", "add");
  const canEdit = can("StockReceive", "edit");
  const canDelete = can("StockReceive", "delete");

  /** Two jobs on one screen: confirming what the factory sent (the normal path)
   *  and entering a receive by hand (opening stock, outside purchases). */
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const [receives, setReceives] = useState<ReceiveRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [pending, setPending] = useState<PendingReceive[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [confirmDoc, setConfirmDoc] = useState<PendingReceiveDetail | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);
  const [filterBranchId, setFilterBranchId] = useState("");

  const [modal, setModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<ReceiveGroup | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [purDate, setPurDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromBranchId, setFromBranchId] = useState("");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  /** Keyed by item id. Absent = untouched, which is the same as qty 0. */
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  /** Letterhead fallback for the printed pad — company name and address. */
  const [settings, setSettings] = useState<Settings | null>(null);

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.branchName ?? "-";
  const branchAddress = (id?: string) => branches.find((b) => b.id === id)?.address || undefined;

  /** The saved receive as a Goods Received Note — the receiving end of the same
   *  pad the Delivery Challan prints, so the two can be checked against each
   *  other line for line. The letterhead is the RECEIVING branch, because this
   *  copy of the document belongs to it. */
  const savedNote = (doc: ReceiveGroup): DeliveryChallanData => ({
    companyName: settings?.companyName || "Khazana Mithai",
    companyAddress: settings?.companyAddress || undefined,
    letterheadAddress: doc.branchAddress || branchAddress(doc.branchId),
    fromBranchName: branchName(doc.fromBranchId),
    toBranchName: doc.branchName || branchName(doc.branchId),
    challanNo: doc.voucherNo || doc.serialNo,
    issueDate: doc.purDate ?? "",
    preparedBy: user?.name || user?.userName || undefined,
    items: doc.items.map((it) => ({ itemName: it.itemName ?? "-", uom: it.uom, qty: Number(it.qty ?? 0) })),
  });

  const loadList = () => {
    setListLoading(true);
    fetchReceives({ page, limit, fromDate, toDate, branchId: filterBranchId || undefined })
      .then(({ items, meta }) => { setReceives(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  const loadPending = () => {
    setPendingLoading(true);
    fetchPendingReceives({ page: 1, limit: 100, fromDate, toDate })
      .then(({ items }) => setPending(items))
      .catch(() => setPending([]))
      .finally(() => setPendingLoading(false));
  };

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchBranches().then(setBranches).catch(() => {});
    // Letterhead fallback only — a failure here still leaves a printable pad.
    fetchSettings().then(setSettings).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate, filterBranchId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadPending, [fromDate, toDate, refreshKey]);

  const openConfirm = async (record: PendingReceive) => {
    setConfirmDoc(null);
    setConfirmOpen(true);
    setConfirmLoading(true);
    try {
      setConfirmDoc(await fetchPendingReceive(record.serialNo));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load the issued items"));
      setConfirmOpen(false);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmDoc) return;
    setConfirming(true);
    try {
      await confirmReceive(confirmDoc.serialNo);
      toast.success(`Received ${confirmDoc.serialNo}`);
      setConfirmOpen(false);
      loadPending();
      loadList();
    } catch (err) {
      // A 409 here means somebody else confirmed it first — refresh so the row
      // disappears rather than leaving a document that can no longer be actioned.
      toast.error(getErrorMessage(err, "Failed to confirm receipt"));
      loadPending();
    } finally {
      setConfirming(false);
    }
  };

  const entryFor = (itemId: string) => entries[itemId] ?? BLANK_ENTRY;

  const setEntry = (itemId: string, qty: string) =>
    setEntries((prev) => ({ ...prev, [itemId]: { qty } }));

  /** The lines that will actually be saved: qty > 0, in catalogue order. Every
   *  other row in the grid is ignored, so an untouched catalogue submits
   *  nothing. */
  const validLines = useMemo(
    () =>
      availableItems
        .filter((it) => parseFloat(entries[it.id]?.qty ?? "") > 0)
        .map((it) => ({ itemId: it.id, qty: parseFloat(entries[it.id].qty) })),
    [availableItems, entries],
  );

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
    setVoucherNo("");
    setPurDate(new Date().toISOString().split("T")[0]);
    setFromBranchId("");
    setEntries({});
    setItemSearch("");
    setModal(true);
  };

  const openEdit = async (record: ReceiveRecord) => {
    try {
      const full = await fetchReceive(record.serialNo);
      setEditingSerial(full.serialNo);
      setSerialNo(full.serialNo);
      setVoucherNo(full.voucherNo ?? "");
      setPurDate(full.purDate ? full.purDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      setFromBranchId(full.fromBranchId ?? "");
      setItemSearch("");
      // Repeated lines of one item collapse into the grid's single row for it.
      setEntries(
        full.items.reduce<Record<string, ItemEntry>>((acc, it) => {
          const previous = parseFloat(acc[it.itemId]?.qty ?? "0") || 0;
          acc[it.itemId] = { qty: String(previous + Number(it.qty ?? 0)) };
          return acc;
        }, {}),
      );
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load receive record")); }
  };

  const openReport = async (record: ReceiveRecord) => {
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      const full = await fetchReceive(record.serialNo);
      setReport(full);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load receive report"));
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handleDelete = async (record: ReceiveRecord) => {
    if (!confirm(`Delete stock receive "${record.serialNo}"?`)) return;
    try {
      await deleteReceive(record.serialNo);
      toast.success("Stock receive deleted");
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSubmit = async () => {
    // Every quantity zero or blank is the same as an empty submission: nothing
    // to receive, so there is no document to write.
    if (!validLines.length) { toast.error("Enter a quantity on at least one item"); return; }
    if (!fromBranchId) { toast.error("Select the branch to receive from"); return; }
    setSubmitting(true);
    try {
      const payload = { voucherNo, purDate, fromBranchId, items: validLines };
      if (editingSerial) {
        await updateReceive(editingSerial, payload);
        toast.success("Stock receive updated");
      } else {
        await receiveStock(payload);
        toast.success("Stock receive saved");
      }
      setModal(false);
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, `Failed to ${editingSerial ? "update" : "save"}`)); } finally { setSubmitting(false); }
  };

  const handlePreview = () => {
    if (!validLines.length) { toast.error("Enter a quantity on at least one item to preview"); return; }
    const rows = validLines.map((l) => ({
      itemName: availableItems.find((it) => it.id === l.itemId)?.itmName,
      qty: l.qty,
    }));
    previewReport(rows, reportColumns, {
      title: "Stock Receive Preview",
      subtitle: [
        `Serial No: ${editingSerial || "New"}`,
        `Voucher No: ${voucherNo || "-"}`,
        `Date: ${formatDate(purDate)}`,
        `From: ${branchName(fromBranchId)}`,
        `To: ${user?.branchName ?? "-"}`,
      ].join(" · "),
    });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Stock Receive"
        subtitle="Record incoming stock"
        action={canAdd ? { label: "New Receive", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />
      {/* Confirming what was sent is the everyday job, so it leads. */}
      <div className="no-print mb-4 flex border-b border-sage-300 text-sm">
        {([
          ["pending", `Pending Receive${pending.length ? ` (${pending.length})` : ""}`],
          ["history", "Received History"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-primary-800 text-primary-800"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
      {tab === "pending" && (
        <Table
          loading={pendingLoading}
          data={pending.map((p) => ({ id: p.serialNo, ...p }))}
          columns={[
            { key: "issueDate", header: "Issue Date", render: (r) => formatDate(r.issueDate ?? "") },
            { key: "serialNo", header: "Issue ID", render: (r) => <span className="font-medium">{r.serialNo}</span> },
            { key: "issueBranchId", header: "From Branch", render: (r) => branchName(r.issueBranchId) },
            { key: "totalItems", header: "Total Items", className: "text-right" },
            { key: "totalQty", header: "Total Qty", className: "text-right" },
            {
              key: "status", header: "Status",
              render: () => (
                <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                  Pending
                </span>
              ),
            },
            {
              key: "actions", header: "",
              render: (r) => (
                <Button size="sm" onClick={() => openConfirm(r)} disabled={!canAdd}>
                  View &amp; Receive
                </Button>
              ),
            },
          ]}
        />
      )}
      {tab === "pending" && !pendingLoading && pending.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">
          Nothing waiting to be received for this branch in the selected dates.
        </p>
      )}

      {tab === "history" && (
      <Table loading={listLoading} data={receives}
        columns={[
          { key: "purDate", header: "Date", render: (r) => formatDate(r.purDate) },
          {
            key: "serialNo", header: "Serial No",
            render: (r) => r.serialNo ? (
              <button onClick={() => openReport(r)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ) : "-",
          },
          { key: "qty", header: "Total Qty", className: "text-right" },
          // On the raw Item_Receive row `branchId` is the SOURCE and
          // `receiveBranchID` the destination — the same split findOneReceive
          // flips when it builds the document.
          { key: "branchId", header: "From Branch", render: (r) => branchName(r.branchId) },
          { key: "receiveBranchID", header: "Receive Branch", render: (r) => branchName(r.receiveBranchID) },
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
      )}
      {tab === "history" && meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}

      <Modal open={modal} onClose={() => setModal(false)} title={editingSerial ? "Edit Stock Receive" : "New Receive"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-5">
          {editingSerial && <Input label="Serial No" value={serialNo} disabled readOnly />}
          <Input label="Voucher No" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
          <Input label="Date" type="date" value={purDate} onChange={(e) => setPurDate(e.target.value)} />
          <Select
            label="Receive From Branch"
            value={fromBranchId}
            onChange={(e) => setFromBranchId(e.target.value)}
            placeholder="Select source branch..."
            options={branches.map((b) => ({ value: b.id, label: b.branchName }))}
          />
          <Input label="Received Branch" value={user?.branchName ?? "Your branch"} disabled readOnly />
        </div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <Input
            placeholder="Search items by code or name..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="w-72"
          />
          <div className="text-sm text-gray-500">
            {validLines.length} item{validLines.length === 1 ? "" : "s"} to receive
          </div>
        </div>

        {/* The whole catalogue, with the quantity typed inline. Only rows
            carrying a quantity are saved. */}
        <div className="border border-sage-300 rounded-lg overflow-auto max-h-[45vh]">
          <table className="w-full text-sm">
            <thead className="bg-sage-100 sticky top-0 z-10">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Item ID</th>
                <th className="px-3 py-2 font-medium">Item Name</th>
                <th className="px-3 py-2 font-medium text-right">Current Stock</th>
                <th className="px-3 py-2 font-medium text-right w-32">Receive Qty</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const entry = entryFor(it.id);
                const qty = parseFloat(entry.qty) || 0;
                return (
                  <tr key={it.id} className={`border-t border-sage-200 ${qty > 0 ? "bg-primary-50/40" : ""}`}>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{it.itmCode}</td>
                    <td className="px-3 py-1.5">{it.itmName}</td>
                    {/* Context only — receiving adds stock, so nothing to cap. */}
                    <td className="px-3 py-1.5 text-right text-gray-500">{it.stock ?? 0}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.qty}
                        placeholder="0"
                        onChange={(e) => setEntry(it.id, e.target.value)}
                        className="w-full border border-sage-400 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
                      />
                    </td>
                  </tr>
                );
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    No items match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handlePreview} disabled={!validLines.length}>Preview</Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            // Nothing to save until at least one line carries a quantity.
            disabled={!validLines.length || !fromBranchId}
          >
            {editingSerial ? "Update Stock Receive" : "Save Stock Receive"}
          </Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Stock Receive Report" size="lg">
        {reportLoading || !report ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          (() => {
            const note = savedNote(report);
            const noteRows = challanRows(note.items);
            const totalQty = noteRows.reduce((sum, r) => sum + r.qty, 0);
            return (
              <>
                {/* Letterhead of the receiving branch — the pad's own heading. */}
                <div className="mb-4 pb-4 border-b border-sage-300">
                  <h3 className="text-lg font-semibold text-gray-900">{note.toBranchName}</h3>
                  {note.letterheadAddress && <p className="text-sm text-gray-600">{note.letterheadAddress}</p>}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
                  <div><span className="text-gray-500">Serial No:</span> <span className="font-medium">{report.serialNo}</span></div>
                  <div><span className="text-gray-500">GRN No:</span> <span className="font-medium">{note.challanNo || "-"}</span></div>
                  <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(report.purDate)}</span></div>
                  <div><span className="text-gray-500">From Branch:</span> <span className="font-medium">{note.fromBranchName}</span></div>
                  <div><span className="text-gray-500">To Branch:</span> <span className="font-medium">{note.toBranchName}</span></div>
                </div>

                <div className="mb-3 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => previewGoodsReceivedNote(note)}>
                    <Eye size={14} /> Preview
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => printGoodsReceivedNote(note)}>
                    <Printer size={14} /> Print
                  </Button>
                  <ReportExportButtons
                    rows={noteRows}
                    columns={noteColumns}
                    meta={{
                      title: "Goods Received Note",
                      subtitle: [note.toBranchName, `GRN No: ${note.challanNo || "-"}`, `Date: ${formatDate(report.purDate)}`].join(" · "),
                      footer: ["", "", totalQty.toFixed(2), ""],
                      forcePortrait: true,
                    }}
                    showPrint={false}
                  />
                </div>

                <Table
                  data={noteRows.map((r) => ({ id: r.sl, ...r }))}
                  columns={[
                    { key: "sl", header: "SL No", className: "text-center w-16" },
                    { key: "itemName", header: "Item Of Name", render: (r) => challanItemName(r) },
                    { key: "qty", header: "Received Qty", className: "text-right", render: (r) => r.qty.toFixed(2) },
                    { key: "remarks", header: "Remarks", render: () => "" },
                  ]}
                />
                <div className="mt-2 pr-4 text-right text-sm font-semibold text-gray-700">
                  Total Received: {totalQty.toFixed(2)}
                </div>
              </>
            );
          })()
        )}
      </Modal>
      {/* Read-only by construction: there is no input in this table, and the
          confirm endpoint takes no body — quantities come off the issue. */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Stock Receive" size="lg">
        {confirmLoading || !confirmDoc ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading issued items...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 text-sm">
              <div><span className="text-gray-500">Issue ID:</span> <span className="font-medium">{confirmDoc.serialNo}</span></div>
              <div><span className="text-gray-500">Voucher No:</span> <span className="font-medium">{confirmDoc.voucherNo || "-"}</span></div>
              <div><span className="text-gray-500">Issue Date:</span> <span className="font-medium">{formatDate(confirmDoc.issueDate ?? "")}</span></div>
              <div><span className="text-gray-500">From Branch:</span> <span className="font-medium">{branchName(confirmDoc.issueBranchId)}</span></div>
              <div><span className="text-gray-500">To Branch:</span> <span className="font-medium">{branchName(confirmDoc.receiveBranchId)}</span></div>
              <div>
                <span className="text-gray-500">Status:</span>{" "}
                <span className="font-medium text-amber-700">{confirmDoc.status}</span>
              </div>
            </div>

            <div className="border border-sage-300 rounded-lg overflow-auto max-h-[45vh]">
              <table className="w-full text-sm">
                <thead className="bg-sage-100 sticky top-0">
                  <tr className="text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">Item ID</th>
                    <th className="px-3 py-2 font-medium">Item Name</th>
                    <th className="px-3 py-2 font-medium text-right">Issued Qty</th>
                    <th className="px-3 py-2 font-medium text-center">Production</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmDoc.items.map((it, i) => (
                    <tr key={`${it.itemId}-${i}`} className="border-t border-sage-200">
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{it.itemId.slice(0, 8)}</td>
                      <td className="px-3 py-1.5">{it.itemName ?? "-"}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{it.qty}</td>
                      <td className="px-3 py-1.5 text-center">
                        {it.isProduction ? <span className="text-amber-700 font-medium">Yes</span> : <span className="text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Quantities cannot be changed here. Confirming records these exact quantities as received
              and adds them to stock — it cannot be undone from this screen.
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button
                onClick={handleConfirm}
                loading={confirming}
                disabled={confirmDoc.status !== "Pending" || confirmDoc.items.length === 0}
              >
                Confirm Receive
              </Button>
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
