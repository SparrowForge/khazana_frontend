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
import {
  fetchItems, fetchBranches, fetchReceives, fetchReceive, receiveStock, updateReceive, deleteReceive,
  type AvailableItem, type BranchOption, type ReceiveRecord,
} from "./server";
import { useAuthStore } from "@/store/auth.store";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";

interface ReceiveLine { itemId: string; qty: string; }

export default function StockReceivePage() {
  const user = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const canAdd = can("StockReceive", "add");
  const canEdit = can("StockReceive", "edit");
  const canDelete = can("StockReceive", "delete");

  const [receives, setReceives] = useState<ReceiveRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const [modal, setModal] = useState(false);
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [purDate, setPurDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromBranchId, setFromBranchId] = useState("");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [lines, setLines] = useState<ReceiveLine[]>([{ itemId: "", qty: "1" }]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.branchName ?? "-";

  const loadList = () => {
    setListLoading(true);
    fetchReceives({ page, limit })
      .then(({ items, meta }) => { setReceives(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchBranches().then(setBranches).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta]);

  const addLine = () => setLines([...lines, { itemId: "", qty: "1" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof ReceiveLine, val: string) =>
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const openCreate = () => {
    setEditingSerial(null);
    setSerialNo("");
    setVoucherNo("");
    setPurDate(new Date().toISOString().split("T")[0]);
    setFromBranchId("");
    setLines([{ itemId: "", qty: "1" }]);
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
      setLines(full.items.map((it) => ({ itemId: it.itemId, qty: String(it.qty ?? 1) })));
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load receive record")); }
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
    const valid = lines.filter((l) => l.itemId && parseFloat(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one valid line"); return; }
    if (!fromBranchId) { toast.error("Select the branch to receive from"); return; }
    setSubmitting(true);
    try {
      if (editingSerial) {
        await updateReceive(editingSerial, {
          voucherNo, purDate, fromBranchId,
          items: valid.map((l) => ({ itemId: l.itemId, qty: parseFloat(l.qty) })),
        });
        toast.success("Stock receive updated");
      } else {
        await receiveStock({
          voucherNo, purDate, fromBranchId,
          items: valid.map((l) => ({ itemId: l.itemId, qty: parseFloat(l.qty) })),
        });
        toast.success("Stock receive saved");
      }
      setModal(false);
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, `Failed to ${editingSerial ? "update" : "save"}`)); } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Stock Receive"
        subtitle="Record incoming stock"
        action={canAdd ? { label: "New Receive", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />
      <Table loading={listLoading} data={receives}
        columns={[
          { key: "serialNo", header: "Serial No", render: (r) => r.serialNo || "-" },
          { key: "voucharNo", header: "Voucher No", render: (r) => r.voucharNo || "-" },
          { key: "qty", header: "Total Qty", className: "text-right" },
          { key: "purDate", header: "Date", render: (r) => formatDate(r.purDate) },
          { key: "branchId", header: "From Branch", render: (r) => branchName(r.branchId) },
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
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Select
                label={i === 0 ? "Item" : undefined}
                value={line.itemId}
                onChange={(e) => updateLine(i, "itemId", e.target.value)}
                placeholder="Select item..."
                options={availableItems.map((it) => ({ value: it.id, label: `${it.itmCode} — ${it.itmName}` }))}
                className="flex-1"
              />
              <div className="w-28">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block">Qty</label>}
                <input
                  type="number" min="1" step="1" value={line.qty}
                  onChange={(e) => updateLine(i, "qty", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
                />
              </div>
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 pb-2"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>{editingSerial ? "Update Stock Receive" : "Save Stock Receive"}</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
