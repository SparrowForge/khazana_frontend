"use client";
import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Pagination from "@/components/ui/Pagination";
import Image from "next/image";
import { Plus, Edit2, CheckCircle, XCircle, Camera } from "lucide-react";
import {
  fetchUsers,
  createUser,
  updateUser,
  fetchBranches,
  type AdminUser,
  type Branch,
} from "./server";
import { uploadFile } from "@/lib/upload";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

// Password strength rules — same policy as the reset-password and change-password flows.
function passwordStrengthError(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must contain at least one lowercase letter";
  if (!/\d/.test(pw)) return "Password must contain at least one number";
  return null;
}

const emptyForm = {
  name: "",
  userName: "",
  email: "",
  password: "",
  branchIds: [] as string[],
  isActive: "Y",
  validUntil: "",
  remarks: "",
  mediaFileId: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { can } = usePermissions();
  const canAdd = can("Users", "add");
  const canEdit = can("Users", "edit");

  // Avatar upload state
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();

  const load = () => {
    setLoading(true);
    fetchUsers({ page, limit })
      .then(({ items, meta }) => { setUsers(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); fetchBranches().then(setBranches).catch(() => {}); }, []);
  useEffect(load, [page, limit, refreshKey, setMeta]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setPreviewUrl("");
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
      validUntil: u.validUntil ?? "",
      remarks: u.remarks ?? "",
      mediaFileId: u.mediaFileId ?? "",
    });
    setPreviewUrl(u.profileImage?.fileUrl ?? "");
    setModal(true);
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const mediaFile = await uploadFile(file);
      setForm((f) => ({ ...f, mediaFileId: mediaFile.id }));
      setPreviewUrl(mediaFile.fileUrl);
      toast.success("Avatar uploaded");
    } catch (err) {
      toast.error(getErrorMessage(err, "Avatar upload failed"));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
    // Validate strength when a password is being set: always on create, and on
    // edit only when the field is filled (blank = keep existing password).
    if ((!editing || form.password) && form.password) {
      const pwErr = passwordStrengthError(form.password);
      if (pwErr) { toast.error(pwErr); return; }
    }
    if (!editing && !form.email) { toast.error("Email is required for new users"); return; }
    setSaving(true);
    try {
      const base = {
        name:        form.name        || undefined,
        email:       form.email       || undefined,
        branchIds:   form.branchIds,
        isActive:    form.isActive,
        validUntil:  form.validUntil  || undefined,
        remarks:     form.remarks     || undefined,
        mediaFileId: form.mediaFileId || undefined,
      };
      if (editing) {
        await updateUser(editing.id, form.password ? { ...base, password: form.password } : base);
      } else {
        await createUser({ ...base, userName: form.userName, email: form.email!, password: form.password });
      }
      toast.success(editing ? "User updated" : "User created — verification email sent");
      setModal(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const branchLabel = (u: AdminUser) => {
    const names = u.branchMappings?.map((m) => m.branch.branchName ?? m.branch.branchCode).filter(Boolean);
    if (!names || names.length === 0) return <span className="text-gray-400 text-xs">—</span>;
    return <span title={names.join(", ")}>{names.join(", ")}</span>;
  };

  const UserAvatar = ({ user, size = 8 }: { user: AdminUser; size?: number }) =>
    user.profileImage?.fileUrl ? (
      <Image
        src={user.profileImage.fileUrl}
        alt={user.name ?? user.userName}
        width={size * 4}
        height={size * 4}
        className="rounded-full object-cover"
        style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }}
      />
    ) : (
      <div className={`w-${size} h-${size} rounded-full bg-primary-100 flex items-center justify-center text-primary-800 text-xs font-semibold`}>
        {(user.name ?? user.userName).slice(0, 2).toUpperCase()}
      </div>
    );

  return (
    <AppLayout>
      <PageHeader title="Users" action={canAdd ? { label: "New User", onClick: openCreate, icon: <Plus size={16} /> } : undefined} />

      <Table
        loading={loading}
        data={users}
        columns={[
          {
            key: "avatar", header: "",
            render: (r) => <UserAvatar user={r} size={8} />,
          },
          { key: "userName", header: "Username" },
          { key: "name", header: "Name" },
          { key: "email", header: "Email", render: (r) => r.email ?? <span className="text-gray-400 text-xs">—</span> },
          { key: "branch", header: "Branch(es)", render: branchLabel },
          { key: "isVerified", header: "Verified", render: (r) => r.isVerified ? <CheckCircle size={15} className="text-green-500" /> : <XCircle size={15} className="text-gray-300" /> },
          { key: "isActive", header: "Active" },
          { key: "actions", header: "", render: (r) => canEdit ? <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button> : null },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit User" : "New User"}>
        {/* Avatar uploader — full-width centered at the top */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative group">
            {uploadingAvatar ? (
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : previewUrl ? (
              <Image
                src={previewUrl}
                alt="Avatar preview"
                width={96}
                height={96}
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 shadow"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 text-gray-400">
                {form.name || form.userName
                  ? <span className="text-2xl font-semibold text-gray-500">{(form.name || form.userName).slice(0, 2).toUpperCase()}</span>
                  : <Camera size={28} />
                }
              </div>
            )}

            {/* Hover overlay — click to trigger file input */}
            {!uploadingAvatar && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={18} className="text-white" />
                <span className="text-white text-xs mt-1">Change</span>
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-2">
            {previewUrl ? "Hover to change photo" : "Click avatar to upload photo"}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleAvatarSelect}
        />

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
            placeholder={editing ? "Leave blank to keep current" : "Min 8 chars, upper, lower & number"}
          />
          <Select
            label="Active"
            value={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.value })}
            options={[{ value: "Y", label: "Yes" }, { value: "N", label: "No" }]}
          />
          <Input
            label="Valid Until"
            type="date"
            value={form.validUntil}
            onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
          />
        </div>

        <div className="mt-4">
          <Textarea
            id="remarks"
            label="Remarks"
            rows={4}
            placeholder="Any notes about this user..."
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
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
