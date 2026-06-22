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
import { Plus, Edit2, CheckCircle, XCircle } from "lucide-react";
import {
  fetchUsers,
  createUser,
  updateUser,
  fetchBranches,
  type AdminUser,
  type Branch,
} from "./server";
import { usePagination } from "@/hooks/usePagination";
import toast from "react-hot-toast";

const emptyForm = {
  name: "",
  userName: "",
  email: "",
  password: "",
  branchIds: [] as string[],
  isActive: "Y",
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchUsers({ page, limit })
      .then(({ items, meta }) => { setUsers(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetchBranches().then(setBranches).catch(() => {});
  }, []);
  useEffect(load, [page, limit, refreshKey]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setForm({
      name: u.name ?? "",
      userName: u.userName,
      email: u.email ?? "",
      password: "",
      branchIds: u.branchMappings?.map((m) => m.branch.id) ?? [],
      isActive: u.isActive ?? "Y",
    });
    setModal(true);
  };

  const toggleBranch = (id: string) => {
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id)
        ? f.branchIds.filter((b) => b !== id)
        : [...f.branchIds, id],
    }));
  };

  const handleSave = async () => {
    if (!form.userName) { toast.error("Username is required"); return; }
    if (form.branchIds.length === 0) { toast.error("At least one branch must be selected"); return; }
    if (!editing && !form.password) { toast.error("Password is required for new users"); return; }
    if (!editing && !form.email) { toast.error("Email is required for new users"); return; }
    setSaving(true);
    try {
      const base = {
        name: form.name || undefined,
        email: form.email || undefined,
        branchIds: form.branchIds,
        isActive: form.isActive,
      };
      if (editing) {
        await updateUser(editing.id, form.password ? { ...base, password: form.password } : base);
      } else {
        await createUser({ ...base, userName: form.userName, email: form.email, password: form.password });
      }
      toast.success(editing ? "User updated" : "User created — verification email sent");
      setModal(false);
      load();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? String(msg[0]) : (typeof msg === "string" ? msg : "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const branchLabel = (u: AdminUser) => {
    const names = u.branchMappings?.map((m) => m.branch.branchName ?? m.branch.branchCode).filter(Boolean);
    if (!names || names.length === 0) return <span className="text-gray-400 text-xs">—</span>;
    return <span title={names.join(", ")}>{names.join(", ")}</span>;
  };

  return (
    <AppLayout>
      <PageHeader title="Users" action={{ label: "New User", onClick: openCreate, icon: <Plus size={16} /> }} />
      <Table
        loading={loading}
        data={users}
        columns={[
          { key: "userName", header: "Username" },
          { key: "name", header: "Name" },
          { key: "email", header: "Email", render: (r) => r.email ?? <span className="text-gray-400 text-xs">—</span> },
          { key: "branch", header: "Branch(es)", render: branchLabel },
          { key: "isVerified", header: "Verified", render: (r) => r.isVerified ? <CheckCircle size={15} className="text-green-500" /> : <XCircle size={15} className="text-gray-300" /> },
          { key: "isActive", header: "Active" },
          { key: "actions", header: "", render: (r) => <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button> },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit User" : "New User"}>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Username *"
            value={form.userName}
            onChange={(e) => setForm({ ...form, userName: e.target.value })}
            disabled={!!editing}
            placeholder="john.doe"
          />
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="John Doe"
          />
          <Input
            label={editing ? "Email" : "Email *"}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={!!editing}
            placeholder="user@example.com"
          />
          <Input
            label={editing ? "New Password (leave blank to keep)" : "Password *"}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={editing ? "Leave blank to keep current" : "Min 6 characters"}
          />
          <Select
            label="Active"
            value={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.value })}
            options={[{ value: "Y", label: "Yes" }, { value: "N", label: "No" }]}
          />
        </div>

        {/* Branch multi-select */}
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Branch Access *</p>
          <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
            {branches.length === 0 ? (
              <p className="text-xs text-gray-400">No branches available</p>
            ) : (
              branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.branchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                    className="accent-primary-800"
                  />
                  <span className="text-sm text-gray-700">
                    {b.branchName ?? b.branchCode ?? b.id}
                  </span>
                </label>
              ))
            )}
          </div>
          {form.branchIds.length === 0 && (
            <p className="text-xs text-red-500 mt-1">At least one branch must be selected</p>
          )}
        </div>

        {!editing && (
          <p className="text-xs text-gray-400 mt-3">
            A verification email will be sent to the address above after the user is created.
          </p>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editing ? "Update" : "Create User"}</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
