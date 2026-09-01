"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import { Plus, Edit2 } from "lucide-react";
import { fetchBranches, createBranch, updateBranch, type Branch } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

// New branches appear on the Demand Report unless the box is unticked, which
// is how every branch behaved before the flag existed.
const emptyForm = { branchCode: "", branchName: "", address: "", vatNo: "", mobileNo: "", sortingNo: "", showInDemandReport: true };

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { can } = usePermissions();
  const canAdd = can("Branches", "add");
  const canEdit = can("Branches", "edit");
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchBranches({ page, limit })
      .then(({ items, meta }) => { setBranches(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey, setMeta]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (b: Branch) => { setEditing(b); setForm({ branchCode: b.branchCode, branchName: b.branchName, address: b.address ?? "", vatNo: b.vatNo ?? "", mobileNo: b.mobileNo ?? "", sortingNo: b.sortingNo == null ? "" : String(b.sortingNo), showInDemandReport: b.showInDemandReport ?? true }); setModal(true); };

  const handleSave = async () => {
    if (!form.branchCode || !form.branchName) { toast.error("Code and name are required"); return; }
    setSaving(true);
    try {
      // Blank means "no position" — send it as omitted rather than 0, which
      // would sort the branch to the very front of every report.
      const { sortingNo, ...rest } = form;
      const payload = { ...rest, ...(sortingNo.trim() ? { sortingNo: Number(sortingNo) } : {}) };
      if (editing) await updateBranch(editing.id, payload);
      else await createBranch(payload);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save")); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Branches" action={canAdd ? { label: "New Branch", onClick: openCreate, icon: <Plus size={16} /> } : undefined} />
      <Table loading={loading} data={branches}
        columns={[
          { key: "sortingNo", header: "Sort No", className: "text-center w-20", render: (r) => r.sortingNo ?? "-" },
          { key: "branchCode", header: "Code" },
          { key: "branchName", header: "Branch Name" },
          { key: "address", header: "Address" },
          { key: "vatNo", header: "VAT No" },
          { key: "mobileNo", header: "Mobile" },
          {
            key: "showInDemandReport",
            header: "Demand Report",
            className: "text-center w-32",
            render: (r) => (r.showInDemandReport ?? true) ? "Yes" : "No",
          },
          { key: "actions", header: "", render: (r) => canEdit ? <button onClick={() => openEdit(r)} className="text-primary-600 hover:text-primary-800"><Edit2 size={14} /></button> : null },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Branch" : "New Branch"}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input label="Branch Code *" value={form.branchCode} onChange={(e) => setForm({ ...form, branchCode: e.target.value })} />
            {editing && form.branchCode.trim() !== editing.branchCode && (
              <p className="mt-1 text-xs text-amber-600">
                Documents already saved keep the old code in their serial numbers ({editing.branchCode}); only new ones use the new code.
              </p>
            )}
          </div>
          <Input label="Branch Name *" value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} />
          <Input label="VAT No" value={form.vatNo} onChange={(e) => setForm({ ...form, vatNo: e.target.value })} />
          <Input label="Mobile" value={form.mobileNo} onChange={(e) => setForm({ ...form, mobileNo: e.target.value })} />
          <Input
            label="Sorting No"
            type="number"
            min="0"
            placeholder="Leave blank to sort last"
            value={form.sortingNo}
            onChange={(e) => setForm({ ...form, sortingNo: e.target.value })}
          />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="col-span-2" />
          <label className="col-span-2 flex items-center gap-2 text-sm font-medium text-gray-700 select-none">
            <input
              type="checkbox"
              checked={form.showInDemandReport}
              onChange={(e) => setForm({ ...form, showInDemandReport: e.target.checked })}
              className="h-4 w-4 rounded border-sage-400 text-primary-800 focus:ring-primary-800"
            />
            Show in Demand Report
          </label>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          <span className="font-medium">Sorting No</span> sets the position of this branch on the reports that show one
          column per branch (Demand Report and the pickers above it). Lowest first; a branch left blank sorts last.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          <span className="font-medium">Show in Demand Report</span> gives the branch its own column on the Demand
          Report. Untick it and the branch drops off the sheet — its demands are left out of the column totals too,
          unless it is picked as the Demand From Branch.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
