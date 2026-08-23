"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
  fetchItems, fetchBranches, fetchIssues, fetchIssue, issueStock, updateIssue, deleteIssue,
  type AvailableItem, type BranchOption, type IssueRecord, type IssueGroup,
} from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import { isFactoryBranch } from "@/lib/branch";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { previewReport, type ExportColumn } from "@/lib/export/reportExport";

/** What the user typed against one item in the entry grid. The grid lists the
 *  whole catalogue, so most items carry an empty `qty` and are simply skipped —
 *  only rows with qty > 0 are ever sent. */
interface ItemEntry { qty: string; isProduction: boolean; }

const BLANK_ENTRY: ItemEntry = { qty: "", isProduction: false };

const reportColumns: ExportColumn<{ itemName?: string; qty: number; unitPrice?: number; isProduction?: boolean }>[] = [
  { header: "Item Name", value: (r) => r.itemName ?? "-" },
  { header: "Qty", value: (r) => r.qty, numeric: true },
  { header: "Unit Price", value: (r) => r.unitPrice ?? 0, numeric: true },
  { header: "Production", value: (r) => (r.isProduction ? "Yes" : "") },
];

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
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<IssueGroup | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  // Issuing branch is always the session branch and is not editable — an issue
  // can only send stock out of the branch the user is logged in at.
  const sessionUser = useAuthStore((st) => st.user);
  const issueBranchId = sessionUser?.branchId ?? "";
  const isFactorySession = isFactoryBranch(sessionUser);
  const [receiveBranchId, setReceiveBranchId] = useState("");
  /** Keyed by item id. Absent = untouched, which is the same as qty 0. */
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  /** Qty per item as the document being edited was saved. Editing is
   *  purge-and-replace — the stock it already took out comes back to it — so
   *  current on-hand plus this is what the form may commit. Empty when creating. */
  const [heldStock, setHeldStock] = useState<Record<string, number>>({});

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.branchName ?? "-";

  /** On-hand qty an issue may still draw on for an item. An issue can't drive
   *  Inventory negative, so this is the ceiling — the server enforces it again. */
  const availableFor = (itemId: string) =>
    (availableItems.find((it) => it.id === itemId)?.stock ?? 0) + (heldStock[itemId] ?? 0);

  /** Lines asking for more than is available, summed per item so the same item
   *  entered on two lines is measured against one balance. */
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
    fetchIssues({ page, limit, fromDate, toDate, branchId: filterBranchId || undefined })
      .then(({ items, meta }) => { setIssues(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchBranches().then(setBranches).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta, fromDate, toDate, filterBranchId]);

  const entryFor = (itemId: string) => entries[itemId] ?? BLANK_ENTRY;

  const setEntry = (itemId: string, patch: Partial<ItemEntry>) =>
    setEntries((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? BLANK_ENTRY), ...patch } }));

  /** The lines that will actually be saved: qty > 0, in catalogue order. A
   *  production tick on a zero-qty row is ignored rather than rejected — the
   *  user simply hasn't filled that row in. */
  const validLines = useMemo(
    () =>
      availableItems
        .map((it) => ({ item: it, entry: entries[it.id] }))
        .filter(({ entry }) => parseFloat(entry?.qty ?? "") > 0)
        .map(({ item, entry }) => ({
          itemId: item.id,
          qty: parseFloat(entry!.qty),
          unitPrice: Number(item.price ?? 0),
          // Only the factory may produce, so the flag can never leave a shop
          // session even if a stale checkbox state survived a branch switch.
          isProduction: isFactorySession && entry!.isProduction,
        })),
    [availableItems, entries, isFactorySession],
  );

  /** Items the production flag can apply to at all: a tick on a zero-qty row is
   *  never sent, so those rows are neither counted nor toggled by Check All. */
  const productionEligible = useMemo(
    () => availableItems.filter((it) => parseFloat(entries[it.id]?.qty ?? "") > 0),
    [availableItems, entries],
  );
  const checkedCount = productionEligible.filter((it) => entries[it.id]?.isProduction).length;
  const allChecked = productionEligible.length > 0 && checkedCount === productionEligible.length;

  /** Tick every item that has a quantity, or clear them all when they already
   *  are. Rows with no quantity are left alone — checking them would set a flag
   *  the save then silently drops. */
  const toggleAllProduction = () => {
    const next = !allChecked;
    setEntries((prev) => {
      const draft = { ...prev };
      for (const it of productionEligible) {
        draft[it.id] = { ...(draft[it.id] ?? BLANK_ENTRY), isProduction: next };
      }
      return draft;
    });
  };

  /** Part-ticked reads as a dash rather than a misleading empty box; the DOM
   *  property has no JSX attribute, so it has to be set on the node. */
  const checkAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkAllRef.current) {
      checkAllRef.current.indeterminate = checkedCount > 0 && !allChecked;
    }
  }, [checkedCount, allChecked]);

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
    setHeldStock({});
    setSerialNo("");
    setVoucherNo("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setReceiveBranchId("");
    setEntries({});
    setItemSearch("");
    setModal(true);
  };

  const openEdit = async (record: IssueRecord) => {
    try {
      const full = await fetchIssue(record.serialNo);
      setEditingSerial(full.serialNo);
      setSerialNo(full.serialNo);
      setVoucherNo(full.voucherNo ?? "");
      setIssueDate(full.issueDate ? full.issueDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      setReceiveBranchId(full.receiveBranchId ?? "");
      setItemSearch("");
      // Repeated lines of one item collapse into the grid's single row for it,
      // the same way the server sums them against one balance.
      setEntries(
        full.items.reduce<Record<string, ItemEntry>>((acc, it) => {
          const previous = parseFloat(acc[it.itemId]?.qty ?? "0") || 0;
          acc[it.itemId] = {
            qty: String(previous + Number(it.qty ?? 0)),
            isProduction: acc[it.itemId]?.isProduction || !!it.isProduction,
          };
          return acc;
        }, {}),
      );
      setHeldStock(
        full.items.reduce<Record<string, number>>((acc, it) => {
          acc[it.itemId] = (acc[it.itemId] ?? 0) + Number(it.qty ?? 0);
          return acc;
        }, {}),
      );
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load issue record")); }
  };

  const openReport = async (record: IssueRecord) => {
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      const full = await fetchIssue(record.serialNo);
      setReport(full);
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

  const handleSubmit = async () => {
    if (!issueBranchId) { toast.error("No branch on this session — sign in again"); return; }
    if (!receiveBranchId) { toast.error("Select the receiving branch"); return; }
    // Every quantity zero or blank is the same as an empty submission: nothing
    // to issue, so there is no document to write.
    if (!validLines.length) { toast.error("Enter a quantity on at least one item"); return; }
    const short = stockShortages(validLines);
    if (short.length) {
      toast.error(`Not enough stock: ${short.map((s) => `${s.name} (${s.available} available, ${s.qty} requested)`).join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      const payload = { voucherNo, issueDate, issueBranchId, receiveBranchId, items: validLines };
      if (editingSerial) {
        await updateIssue(editingSerial, payload);
        toast.success("Stock issue updated");
      } else {
        await issueStock(payload);
        toast.success("Stock issue saved");
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
      unitPrice: l.unitPrice,
      isProduction: l.isProduction,
    }));
    previewReport(rows, reportColumns, {
      title: "Stock Issue Preview",
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
        title="Stock Issue"
        subtitle="Record outgoing stock"
        action={canAdd ? { label: "New Issue", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
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
          {
            key: "serialNo", header: "Serial No",
            render: (r) => r.serialNo ? (
              <button onClick={() => openReport(r)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ) : "-",
          },
          { key: "qty", header: "Total Qty", className: "text-right" },
          { key: "issueDate", header: "Date", render: (r) => formatDate(r.issueDate) },
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingSerial ? "Edit Stock Issue" : "New Issue"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-5">
          {editingSerial && <Input label="Serial No" value={serialNo} disabled readOnly />}
          <Input label="Voucher No" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
          <Input label="Date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          {/* Fixed to the session branch: an issue can only send stock out of
              the branch the user is logged in at, so there is nothing to pick. */}
          <Input label="Issuing Branch" value={branchName(issueBranchId)} disabled readOnly />
          <Select label="Issued To Branch" value={receiveBranchId} onChange={(e) => setReceiveBranchId(e.target.value)}
            placeholder="Select branch..." options={branches.map((b) => ({ value: b.id, label: b.branchName }))} />
        </div>

        <div className="flex items-center justify-between gap-3 mb-2">
          <Input
            placeholder="Search items by code or name..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="w-72"
          />
          <div className="text-sm text-gray-500">
            {validLines.length} item{validLines.length === 1 ? "" : "s"} to issue
            {isFactorySession && validLines.some((l) => l.isProduction)
              ? ` · ${validLines.filter((l) => l.isProduction).length} to production`
              : ""}
          </div>
        </div>

        {/* The whole catalogue, with the quantity typed inline. Scrolls rather
            than paginates so a part-filled sheet is never split across pages. */}
        <div className="border border-gray-200 rounded-lg overflow-auto max-h-[45vh]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Item ID</th>
                <th className="px-3 py-2 font-medium">Item Name</th>
                <th className="px-3 py-2 font-medium text-right">Available</th>
                <th className="px-3 py-2 font-medium text-right w-32">Issue Qty</th>
                {isFactorySession && (
                  <th className="px-3 py-2 font-medium text-center w-32">
                    <label className="flex items-center justify-center gap-1.5 cursor-pointer select-none">
                      <input
                        ref={checkAllRef}
                        type="checkbox"
                        checked={allChecked}
                        // Nothing to check until at least one quantity is typed.
                        disabled={productionEligible.length === 0}
                        onChange={toggleAllProduction}
                        className="h-4 w-4 accent-amber-600 disabled:opacity-30"
                        title="Check every item that has an issue quantity"
                      />
                      <span>Is Production</span>
                    </label>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const entry = entryFor(it.id);
                const qty = parseFloat(entry.qty) || 0;
                const available = availableFor(it.id);
                const over = qty > available;
                return (
                  <tr
                    key={it.id}
                    className={`border-t border-gray-100 ${
                      // Production-selected rows are called out; an over-issue
                      // outranks that, since it blocks the save.
                      over ? "bg-red-50" : entry.isProduction && qty > 0 ? "bg-amber-50" : qty > 0 ? "bg-primary-50/40" : ""
                    }`}
                  >
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{it.itmCode}</td>
                    <td className="px-3 py-1.5">{it.itmName}</td>
                    <td className={`px-3 py-1.5 text-right ${available <= 0 ? "text-gray-400" : ""}`}>{available}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.qty}
                        placeholder="0"
                        onChange={(e) => setEntry(it.id, { qty: e.target.value })}
                        className={`w-full border rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 ${
                          over ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-primary-800"
                        }`}
                      />
                    </td>
                    {isFactorySession && (
                      <td className="px-3 py-1.5 text-center">
                        {/* Disabled without a quantity: the line would not be
                            sent at all, so do not invite the tick. */}
                        <input
                          type="checkbox"
                          checked={entry.isProduction}
                          disabled={qty <= 0}
                          onChange={(e) => setEntry(it.id, { isProduction: e.target.checked })}
                          className="h-4 w-4 accent-amber-600 disabled:opacity-30"
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={isFactorySession ? 5 : 4} className="px-3 py-6 text-center text-gray-400">
                    No items match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isFactorySession && (
          <p className="mt-2 text-xs text-gray-500">
            Ticking <span className="font-medium text-amber-700">Is Production</span> also records the line in Production
            Entry, which adds that quantity back to stock - use it for goods this document both manufactured and shipped.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handlePreview} disabled={!validLines.length}>Preview</Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!validLines.length || !receiveBranchId}
          >
            {editingSerial ? "Update Stock Issue" : "Save Stock Issue"}
          </Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Stock Issue Report" size="lg">
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
                  title: "Stock Issue Report",
                  subtitle: [
                    `Serial No: ${report.serialNo}`,
                    `Voucher No: ${report.voucherNo || "-"}`,
                    `Date: ${formatDate(report.issueDate)}`,
                    `From: ${branchName(report.issueBranchId)}`,
                    `To: ${branchName(report.receiveBranchId)}`,
                  ].join(" · "),
                }}
                showPreview
              />
            </div>
            <Table
              data={report.items.map((it, i) => ({ id: i, ...it }))}
              columns={[
                { key: "itemName", header: "Item Name", render: (r) => r.itemName ?? "-" },
                { key: "qty", header: "Qty", className: "text-right" },
                { key: "unitPrice", header: "Unit Price", className: "text-right", render: (r) => (r.unitPrice ?? 0).toFixed(2) },
                {
                  key: "isProduction", header: "Production", className: "text-center",
                  render: (r) => (r.isProduction ? <span className="text-amber-700 font-medium">Yes</span> : <span className="text-gray-300">-</span>),
                },
              ]}
            />
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
