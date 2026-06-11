"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Edit2, CheckCircle, XCircle } from "lucide-react";
import {
  fetchUsers,
  createUser,
  updateUser,
  fetchBranches,
  type AdminUser,
  type Branch,
} from "./server";
import toast from "react-hot-toast";

const emptyForm = {
  name: "",
  userName: "",
  email: "",
  password: "",
  branchId: "",
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

  const load = () => {
    setLoading(true);
    fetchUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetchBranches().then(setBranches).catch(() => {});
  }, []);

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
      branchId: String(u.branchId),
      isActive: u.isActive ?? "Y",
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.userName || !form.branchId) {
      toast.error("Username and branch are required");
      return;
    }
    if (!editing && !form.password) {
      toast.error("Password is required for new users");
      return;
    }
    if (!editing && !form.email) {
      toast.error("Email is required for new users");
      return;
    }

    setSaving(true);
    try {
      const base = {
        name: form.name || undefined,
        email: form.email || undefined,
        branchId: form.branchId,
        isActive: form.isActive,
      };

      if (editing) {
        await updateUser(
          editing.id,
          form.password ? { ...base, password: form.password } : base,
        );
      } else {
        await createUser({
          ...base,
          userName: form.userName,
          email: form.email,
          password: form.password,
        });
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

  return (
    <AppLayout>
      <PageHeader
        title="Users"
        action={{ label: "New User", onClick: openCreate, icon: <Plus size={16} /> }}
      />

      <Table
        loading={loading}
        data={users}
        columns={[
          { key: "userName", header: "Username" },
          { key: "name", header: "Name" },
          { key: "email", header: "Email", render: (r) => r.email ?? <span className="text-gray-400 text-xs">—</span> },
          {
            key: "branch",
            header: "Branch",
            render: (r) => r.branch?.branchName ?? r.branchId,
          },
          {
            key: "isVerified",
            header: "Verified",
            render: (r) =>
              r.isVerified ? (
                <CheckCircle size={15} className="text-green-500" />
              ) : (
                <XCircle size={15} className="text-gray-300" />
              ),
          },
          { key: "isActive", header: "Active" },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700">
                <Edit2 size={14} />
              </button>
            ),
          },
        ]}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Edit User" : "New User"}
      >
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
            label="Branch *"
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            placeholder="Select branch..."
            options={branches.map((b) => ({ value: b.id, label: b.branchName }))}
          />
          <Select
            label="Active"
            value={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.value })}
            options={[
              { value: "Y", label: "Yes" },
              { value: "N", label: "No" },
            ]}
          />
        </div>

        {!editing && (
          <p className="text-xs text-gray-400 mt-3">
            A verification email will be sent to the address above after the user is created.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editing ? "Update" : "Create User"}
          </Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
