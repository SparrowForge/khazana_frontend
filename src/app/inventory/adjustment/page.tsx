"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  fetchItems, fetchAdjustments, fetchAdjustment, adjustStock, updateAdjustment, deleteAdjustment,
  type AvailableItem, type AdjustmentRecord,
} from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";

interface AdjLine { itmOId: string; reject: string; excess: string; short: string; assort: string; }

export default function StockAdjustmentPage() {
  const { can } = usePermissions();
  const canAdd = can("StockAdjustment", "add");
  const canEdit = can("StockAdjustment", "edit");
  const canDelete = can("StockAdjustment", "delete");

  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    fetchAdjustments({ page, limit })
      .then(({ items, meta }) => { setAdjustments(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta]);

  const addLine = () => setLines([...lines, { itmOId: "", reject: "0", excess: "0", short: "0", assort: "0" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof AdjLine, val: string) =>
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const openCreate = () => {
    setEditingId(null);
    setInvNo("");
    setDate(new Date().toISOString().split("T")[0]);
    setLines([{ itmOId: "", reject: "0", excess: "0", short: "0", assort: "0" }]);
    setModal(true);
  };

  const openEdit = async (record: AdjustmentRecord) => {
    try {
      const full = await fetchAdjustment(record.id);
      setEditingId(full.id);
      setInvNo(full.invNo ?? "");
      setDate(full.date ? full.date.split("T")[0] : new Date().toISOString().split("T")[0]);
      setLines([{
        itmOId: full.itmOId ?? "",
        reject: String(full.reject ?? 0),
        excess: String(full.excess ?? 0),
        short: String(full.short ?? 0),
        assort: String(full.assort ?? 0),
      }]);
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load adjustment record")); }
  };

  const handleDelete = async (record: AdjustmentRecord) => {
    if (!confirm(`Delete adjustment "${record.invNo ?? record.id}"?`)) return;
    try {
      await deleteAdjustment(record.id);
      toast.success("Adjustment deleted");
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSubmit = async () => {
    const valid = lines.filter((l) => l.itmOId);
    if (!valid.length) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        const l = valid[0];
        await updateAdjustment(editingId, {
          invNo, date,
          itmOId: l.itmOId,
          reject: parseFloat(l.reject), excess: parseFloat(l.excess), short: parseFloat(l.short), assort: parseFloat(l.assort),
        });
        toast.success("Adjustment updated");
      } else {
        await adjustStock({
          invNo, date,
          items: valid.map((l) => ({
            itmOId: l.itmOId,
            reject: parseFloat(l.reject), excess: parseFloat(l.excess), short: parseFloat(l.short), assort: parseFloat(l.assort),
          })),
        });
        toast.success("Adjustment saved");
      }
      setModal(false);
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, `Failed to ${editingId ? "update" : "save"}`)); } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Stock Adjustment"
        subtitle="Record reject, excess, short, assort adjustments"
        action={canAdd ? { label: "New Adjustment", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />
      <Table loading={listLoading} data={adjustments}
        columns={[
          { key: "invNo", header: "Reference No", render: (r) => r.invNo || "-" },
          { key: "itmOId", header: "Item", render: (r) => r.item ? `${r.item.itmCode} — ${r.item.itmName ?? ""}` : itemLabel(r.itmOId) },
          { key: "reject", header: "Reject", className: "text-right" },
          { key: "excess", header: "Excess", className: "text-right" },
          { key: "short", header: "Short", className: "text-right" },
          { key: "assort", header: "Assort", className: "text-right" },
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingId ? "Edit Adjustment" : "New Adjustment"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Input label="Reference No" value={invNo} onChange={(e) => setInvNo(e.target.value)} />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-6 gap-2 text-xs font-semibold text-gray-600 px-1">
            <span className="col-span-2">Item</span><span>Reject</span><span>Excess</span><span>Short</span><span>Assort</span>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 items-center">
              <select value={line.itmOId} onChange={(e) => updateLine(i, "itmOId", e.target.value)}
                className="col-span-2 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800">
                <option value="">Select...</option>
                {availableItems.map((it) => <option key={it.id} value={it.id}>{it.itmCode} — {it.itmName}</option>)}
              </select>
              {(["reject", "excess", "short", "assort"] as const).map((f) => (
                <input key={f} type="number" min="0" step="0.01" value={line[f]}
                  onChange={(e) => updateLine(i, f, e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              ))}
              {!editingId && (
                <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
          {!editingId && (
            <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>{editingId ? "Update Adjustment" : "Save Adjustment"}</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
