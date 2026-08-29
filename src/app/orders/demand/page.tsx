"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Pagination from "@/components/ui/Pagination";
import { Plus, Trash2, Edit2 } from "lucide-react";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import {
  fetchDemandOrders, fetchDemandOrder, createDemandOrder, updateDemandOrder, deleteDemandOrder,
  DEMAND_ORDER_TYPES, demandTypeLabel,
  type DemandOrder, type DemandOrderRecord, type DemandOrderDetail,
} from "./server";
import { fetchAllItems, fetchBranches, type AvailableItem, type BranchInfo } from "../server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import type { ExportColumn } from "@/lib/export/reportExport";

/** What the user typed against one item in the entry grid. The grid lists the
 *  whole catalogue, so most items carry an empty `qty` and are simply skipped —
 *  only rows with qty > 0 are ever sent. */
interface ItemEntry { qty: string; remarks: string; }

const BLANK_ENTRY: ItemEntry = { qty: "", remarks: "" };

/** Date `days` from today as `YYYY-MM-DD`. Stepped in UTC to match how the rest
 *  of the app keys dates (`toISOString().split("T")[0]`), so it can't land on
 *  the wrong day for a server in another timezone. */
const dateFromToday = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
};

/** A demand raised today is for tomorrow — the factory produces overnight
 *  against what the outlets asked for during the day. */
const DEFAULT_REQUIRED_OFFSET = 1;

export default function DemandOrderPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<DemandOrder[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Keyed by item id. Absent = untouched, which is the same as qty 0. */
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [form, setForm] = useState({
    toBranchId: "",
    demandDate: dateFromToday(0),
    requiredDate: dateFromToday(DEFAULT_REQUIRED_OFFSET),
    // Which round this demand is. Defaults to the first — the common case — but
    // it is a real choice, not a hidden default: the report filters on it.
    orderType: "First",
    remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<DemandOrderRecord | null>(null);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();
  const { can } = usePermissions();
  const canAdd = can("DemandOrders", "add");
  const canEdit = can("DemandOrders", "edit");
  const canDelete = can("DemandOrders", "delete");

  const load = () => {
    setLoading(true);
    fetchDemandOrders({ page, limit })
      .then(({ items, meta }) => { setOrders(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    fetchBranches().then(setBranches).catch(() => {});
    fetchAllItems().then(setAvailableItems).catch(() => {});
  }, []);
  useEffect(load, [page, limit, refreshKey, setMeta]);

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.branchName ?? id ?? "-";
  const itemName = (itemId?: string) => availableItems.find((it) => it.id === itemId)?.itmName ?? itemId ?? "-";

  // The factory branch is wherever a branch's demand orders ultimately land —
  // identified by convention (name/code containing "factory", per prisma/seed.ts)
  // rather than a dedicated flag, since this system has exactly one today.
  const factoryBranch = branches.find((b) => /factory/i.test(b.branchName ?? ""));

  const entryFor = (itemId: string) => entries[itemId] ?? BLANK_ENTRY;

  const setEntry = (itemId: string, patch: Partial<ItemEntry>) =>
    setEntries((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? BLANK_ENTRY), ...patch } }));

  /** The lines that will actually be saved: qty > 0, in catalogue order. A
   *  remark typed against a zero-qty row is ignored — that row isn't demanded. */
  const validLines = useMemo(
    () =>
      availableItems
        .filter((it) => parseFloat(entries[it.id]?.qty ?? "") > 0)
        .map((it) => ({
          itemId: it.id,
          qty: parseFloat(entries[it.id].qty),
          remarks: entries[it.id].remarks || undefined,
        })),
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
    setEditingId(null);
    setForm({
      toBranchId: factoryBranch?.id ?? "",
      demandDate: dateFromToday(0),
      requiredDate: dateFromToday(DEFAULT_REQUIRED_OFFSET),
      orderType: "First",
      remarks: "",
    });
    setEntries({});
    setItemSearch("");
    setModal(true);
  };

  const openEdit = async (order: DemandOrder) => {
    try {
      const full = await fetchDemandOrder(order.id);
      setEditingId(full.id);
      setForm({
        toBranchId: full.toBranchId ?? "",
        demandDate: full.demandDate ? full.demandDate.split("T")[0] : new Date().toISOString().split("T")[0],
        requiredDate: full.requiredDate ? full.requiredDate.split("T")[0] : "",
        // Blank for an order raised before the field existed — left blank rather
        // than defaulted, so re-saving does not invent a round it never had.
        orderType: full.orderType ?? "",
        remarks: full.remarks ?? "",
      });
      setItemSearch("");
      // Repeated lines of one item collapse into the grid's single row for it.
      setEntries(
        (full.details ?? []).reduce<Record<string, ItemEntry>>((acc, d) => {
          const previous = parseFloat(acc[d.itemId]?.qty ?? "0") || 0;
          acc[d.itemId] = {
            qty: String(previous + Number(d.qty ?? 0)),
            remarks: acc[d.itemId]?.remarks || d.remarks || "",
          };
          return acc;
        }, {}),
      );
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load demand order")); }
  };

  const handleSave = async () => {
    if (!form.toBranchId) { toast.error("Select the factory / receiving branch"); return; }
    // Every quantity zero or blank is the same as an empty submission.
    if (!validLines.length) { toast.error("Enter a quantity on at least one item"); return; }
    setSaving(true);
    try {
      const payload = {
        toBranchId: form.toBranchId,
        demandDate: form.demandDate,
        requiredDate: form.requiredDate || undefined,
        orderType: form.orderType || undefined,
        remarks: form.remarks || undefined,
        items: validLines,
      };
      if (editingId) {
        await updateDemandOrder(editingId, payload);
        toast.success("Demand order updated");
      } else {
        await createDemandOrder(payload);
        toast.success("Demand order submitted to factory");
      }
      setModal(false); load();
    } catch (err) { toast.error(getErrorMessage(err, `Failed to ${editingId ? "update" : "submit"} demand order`)); } finally { setSaving(false); }
  };

  const handleDelete = async (order: DemandOrder) => {
    if (!confirm(`Delete demand order "${order.serialNo ?? order.id}"?`)) return;
    try {
      await deleteDemandOrder(order.id);
      toast.success("Demand order deleted");
      load();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete demand order")); }
  };

  const openReport = async (order: DemandOrder) => {
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      const full = await fetchDemandOrder(order.id);
      setReport(full);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load demand order"));
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const reportColumns: ExportColumn<DemandOrderDetail>[] = [
    { header: "Item", value: (r) => itemName(r.itemId) },
    { header: "Qty", value: (r) => r.qty, numeric: true },
    { header: "Remarks", value: (r) => r.remarks ?? "-" },
  ];

  return (
    <AppLayout>
      <PageHeader title="Demand Order" subtitle="Branch stock requisition submitted to the factory" action={canAdd ? { label: "New Demand Order", onClick: openCreate, icon: <Plus size={16} /> } : undefined} />
      <Table loading={loading} data={orders}
        columns={[
          { key: "demandDate", header: "Demand Date", render: (r) => formatDate(r.demandDate) },
          { key: "requiredDate", header: "Required Date", render: (r) => formatDate(r.requiredDate) },
          { key: "orderType", header: "Type", render: (r) => demandTypeLabel(r.orderType) },
          {
            key: "serialNo", header: "DO No",
            render: (r) => r.serialNo ? (
              <button onClick={() => openReport(r)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ) : "-",
          },
          { key: "fromBranchId", header: "From", render: (r) => branchName(r.fromBranchId) },
          { key: "toBranchId", header: "To", render: (r) => branchName(r.toBranchId) },
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingId ? "Edit Demand Order" : "New Demand Order"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Input label="From Branch" value={user?.branchName ?? "-"} disabled />
          <Select label="To (Factory) *" value={form.toBranchId} onChange={(e) => setForm({ ...form, toBranchId: e.target.value })}
            placeholder="Select receiving branch..." options={branches.map((b) => ({ value: b.id, label: b.branchName ?? b.id }))} />
          <Input label="Demand Date" type="date" value={form.demandDate} onChange={(e) => setForm({ ...form, demandDate: e.target.value })} />
          <Input label="Required Date" type="date" value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} />
          <Select label="Order Type" value={form.orderType} onChange={(e) => setForm({ ...form, orderType: e.target.value })}
            placeholder="Select type..." options={DEMAND_ORDER_TYPES} />
          <Input label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
        </div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <Input
            placeholder="Search items by code or name..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="w-72"
          />
          <div className="text-sm text-gray-500">
            {validLines.length} item{validLines.length === 1 ? "" : "s"} demanded
          </div>
        </div>

        {/* The whole catalogue, with the quantity typed inline. Only rows
            carrying a quantity are saved. */}
        <div className="border border-sage-300 rounded-lg overflow-auto max-h-[45vh] mb-4">
          <table className="w-full text-sm">
            <thead className="bg-sage-100 sticky top-0 z-10">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Item ID</th>
                <th className="px-3 py-2 font-medium">Item Name</th>
                <th className="px-3 py-2 font-medium text-right w-28">Demand Qty</th>
                <th className="px-3 py-2 font-medium w-48">Remarks</th>
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
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.qty}
                        placeholder="0"
                        onChange={(e) => setEntry(it.id, { qty: e.target.value })}
                        className="w-full border border-sage-400 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={entry.remarks}
                        placeholder="Optional"
                        // Only sent with a quantity — a remark alone is not a demand.
                        disabled={qty <= 0}
                        onChange={(e) => setEntry(it.id, { remarks: e.target.value })}
                        className="w-full border border-sage-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800 disabled:bg-sage-100"
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

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            loading={saving}
            // Nothing to submit until at least one line carries a quantity.
            disabled={!validLines.length || !form.toBranchId}
          >
            {editingId ? "Update Demand Order" : "Submit to Factory"}
          </Button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Demand Order" size="lg">
        {reportLoading || !report ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
              <div><span className="text-gray-500">DO No:</span> <span className="font-medium">{report.serialNo}</span></div>
              <div><span className="text-gray-500">Demand Date:</span> <span className="font-medium">{formatDate(report.demandDate)}</span></div>
              <div><span className="text-gray-500">From:</span> <span className="font-medium">{branchName(report.fromBranchId)}</span></div>
              <div><span className="text-gray-500">To:</span> <span className="font-medium">{branchName(report.toBranchId)}</span></div>
              <div><span className="text-gray-500">Required Date:</span> <span className="font-medium">{formatDate(report.requiredDate)}</span></div>
              <div><span className="text-gray-500">Remarks:</span> <span className="font-medium">{report.remarks || "-"}</span></div>
            </div>
            <div className="mb-3 flex justify-end">
              <ReportExportButtons
                rows={report.details ?? []}
                columns={reportColumns}
                meta={{
                  title: "Demand Order",
                  subtitle: `DO No: ${report.serialNo} · ${branchName(report.fromBranchId)} → ${branchName(report.toBranchId)} · ${formatDate(report.demandDate)}`,
                }}
                showPreview
              />
            </div>
            <Table
              data={report.details ?? []}
              columns={[
                { key: "itemId", header: "Item", render: (r) => itemName(r.itemId) },
                { key: "qty", header: "Qty", className: "text-right" },
                { key: "remarks", header: "Remarks", render: (r) => r.remarks ?? "-" },
              ]}
            />
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
