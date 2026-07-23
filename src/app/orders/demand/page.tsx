"use client";
import { useEffect, useState } from "react";
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
  type DemandOrder, type DemandOrderRecord, type DemandOrderDetail,
} from "./server";
import { fetchItems, fetchBranches, type AvailableItem, type BranchInfo } from "../server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import type { ExportColumn } from "@/lib/export/reportExport";

interface DemandLine { itemId: string; qty: string; remarks: string; }

export default function DemandOrderPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<DemandOrder[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lines, setLines] = useState<DemandLine[]>([{ itemId: "", qty: "1", remarks: "" }]);
  const [form, setForm] = useState({ toBranchId: "", demandDate: new Date().toISOString().split("T")[0], requiredDate: "", remarks: "" });
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
    fetchItems().then(setAvailableItems).catch(() => {});
  }, []);
  useEffect(load, [page, limit, refreshKey, setMeta]);

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.branchName ?? id ?? "-";
  const itemName = (itemId?: string) => availableItems.find((it) => it.id === itemId)?.itmName ?? itemId ?? "-";

  // The factory branch is wherever a branch's demand orders ultimately land —
  // identified by convention (name/code containing "factory", per prisma/seed.ts)
  // rather than a dedicated flag, since this system has exactly one today.
  const factoryBranch = branches.find((b) => /factory/i.test(b.branchName ?? ""));

  const addLine = () => setLines([...lines, { itemId: "", qty: "1", remarks: "" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, f: keyof DemandLine, v: string) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [f]: v } : l)));

  const openCreate = () => {
    setEditingId(null);
    setForm({ toBranchId: factoryBranch?.id ?? "", demandDate: new Date().toISOString().split("T")[0], requiredDate: "", remarks: "" });
    setLines([{ itemId: "", qty: "1", remarks: "" }]);
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
        remarks: full.remarks ?? "",
      });
      setLines(
        full.details?.length
          ? full.details.map((d) => ({ itemId: d.itemId, qty: String(d.qty), remarks: d.remarks ?? "" }))
          : [{ itemId: "", qty: "1", remarks: "" }],
      );
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load demand order")); }
  };

  const handleSave = async () => {
    if (!form.toBranchId) { toast.error("Select the factory / receiving branch"); return; }
    const valid = lines.filter((l) => l.itemId && parseFloat(l.qty || "0") > 0);
    if (!valid.length) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      const payload = {
        toBranchId: form.toBranchId,
        demandDate: form.demandDate,
        requiredDate: form.requiredDate || undefined,
        remarks: form.remarks || undefined,
        items: valid.map((l) => ({ itemId: l.itemId, qty: parseFloat(l.qty), remarks: l.remarks || undefined })),
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
          { key: "demandDate", header: "Demand Date", render: (r) => formatDate(r.demandDate) },
          { key: "requiredDate", header: "Required Date", render: (r) => formatDate(r.requiredDate) },
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
          <Input label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="col-span-2" />
        </div>
        <div className="space-y-2 mb-4">
          <p className="text-sm font-medium text-gray-700">Demand Items</p>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={l.itemId} onChange={(e) => updateLine(i, "itemId", e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800">
                <option value="">Select item...</option>
                {availableItems.map((it) => <option key={it.id} value={it.id}>{it.itmCode} — {it.itmName}</option>)}
              </select>
              <input type="number" placeholder="Qty" value={l.qty} onChange={(e) => updateLine(i, "qty", e.target.value)}
                className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              <input type="text" placeholder="Remarks (optional)" value={l.remarks} onChange={(e) => updateLine(i, "remarks", e.target.value)}
                className="w-40 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Item</Button>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingId ? "Update Demand Order" : "Submit to Factory"}</Button>
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
