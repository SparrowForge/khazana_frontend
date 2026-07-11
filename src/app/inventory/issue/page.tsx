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
  fetchItems, fetchBranches, fetchIssues, fetchIssue, issueStock, updateIssue, deleteIssue,
  type AvailableItem, type BranchOption, type IssueRecord,
} from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";

interface IssueLine { itemCode: string; qty: string; unitPrice: string; }

export default function StockIssuePage() {
  const { can } = usePermissions();
  const canAdd = can("StockIssue", "add");
  const canEdit = can("StockIssue", "edit");
  const canDelete = can("StockIssue", "delete");

  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [issueBranchId, setIssueBranchId] = useState("");
  const [receiveBranchId, setReceiveBranchId] = useState("");
  const [lines, setLines] = useState<IssueLine[]>([{ itemCode: "", qty: "1", unitPrice: "0" }]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.branchName ?? "-";

  const loadList = () => {
    setListLoading(true);
    fetchIssues({ page, limit })
      .then(({ items, meta }) => { setIssues(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchBranches().then(setBranches).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadList, [page, limit, refreshKey, setMeta]);

  const addLine = () => setLines([...lines, { itemCode: "", qty: "1", unitPrice: "0" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof IssueLine, val: string) =>
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const openCreate = () => {
    setEditingId(null);
    setSerialNo("");
    setVoucherNo("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setIssueBranchId("");
    setReceiveBranchId("");
    setLines([{ itemCode: "", qty: "1", unitPrice: "0" }]);
    setModal(true);
  };

  const openEdit = async (record: IssueRecord) => {
    try {
      const full = await fetchIssue(record.id);
      setEditingId(full.id);
      setSerialNo(full.serialNo ?? "");
      setVoucherNo(full.voucharNo ?? "");
      setIssueDate(full.issueDate ? full.issueDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      setIssueBranchId(full.issueBranchId ?? "");
      setReceiveBranchId(full.receiveBranchId ?? "");
      setLines([{ itemCode: full.itemCode ?? "", qty: String(full.qty ?? 1), unitPrice: String(full.unitPrice ?? 0) }]);
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load issue record")); }
  };

  const handleDelete = async (record: IssueRecord) => {
    if (!confirm(`Delete stock issue "${record.serialNo ?? record.itemCode}"?`)) return;
    try {
      await deleteIssue(record.id);
      toast.success("Stock issue deleted");
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete")); }
  };

  const handleSubmit = async () => {
    if (!issueBranchId || !receiveBranchId) { toast.error("Select both branches"); return; }
    const valid = lines.filter((l) => l.itemCode && parseFloat(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one valid line"); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateIssue(editingId, {
          voucherNo, issueDate, issueBranchId, receiveBranchId,
          itemCode: valid[0].itemCode, qty: parseFloat(valid[0].qty), unitPrice: parseFloat(valid[0].unitPrice || "0"),
        });
        toast.success("Stock issue updated");
      } else {
        await issueStock({
          voucherNo, issueDate, issueBranchId, receiveBranchId,
          items: valid.map((l) => ({ itemCode: l.itemCode, qty: parseFloat(l.qty), unitPrice: parseFloat(l.unitPrice || "0") })),
        });
        toast.success("Stock issue saved");
      }
      setModal(false);
      loadList();
    } catch (err) { toast.error(getErrorMessage(err, `Failed to ${editingId ? "update" : "save"}`)); } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Stock Issue"
        subtitle="Record outgoing stock"
        action={canAdd ? { label: "New Issue", onClick: openCreate, icon: <Plus size={16} /> } : undefined}
      />
      <Table loading={listLoading} data={issues}
        columns={[
          { key: "serialNo", header: "Serial No", render: (r) => r.serialNo || "-" },
          { key: "voucharNo", header: "Voucher No", render: (r) => r.voucharNo || "-" },
          { key: "itemCode", header: "Item" },
          { key: "qty", header: "Qty", className: "text-right" },
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingId ? "Edit Stock Issue" : "New Issue"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-5">
          {editingId && <Input label="Serial No" value={serialNo} disabled readOnly />}
          <Input label="Voucher No" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
          <Input label="Date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <Select label="Issuing Branch" value={issueBranchId} onChange={(e) => setIssueBranchId(e.target.value)}
            placeholder="Select branch..." options={branches.map((b) => ({ value: b.id, label: b.branchName }))} />
          <Select label="Issued To Branch" value={receiveBranchId} onChange={(e) => setReceiveBranchId(e.target.value)}
            placeholder="Select branch..." options={branches.map((b) => ({ value: b.id, label: b.branchName }))} />
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Select
                label={i === 0 ? "Item" : undefined}
                value={line.itemCode}
                onChange={(e) => updateLine(i, "itemCode", e.target.value)}
                placeholder="Select item..."
                options={availableItems.map((it) => ({ value: it.itmCode, label: `${it.itmCode} — ${it.itmName}` }))}
                className="flex-1"
              />
              <div className="w-24">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block">Qty</label>}
                <input type="number" min="1" step="1" value={line.qty} onChange={(e) => updateLine(i, "qty", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              </div>
              <div className="w-28">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block">Unit Price</label>}
                <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              </div>
              {!editingId && (
                <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 pb-2"><Trash2 size={16} /></button>
              )}
            </div>
          ))}
          {!editingId && (
            <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>{editingId ? "Update Stock Issue" : "Save Stock Issue"}</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
