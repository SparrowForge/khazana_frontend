"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  fetchRoles,
  fetchMenus,
  fetchPermissions,
  savePermissions,
  type Role,
  type Menu,
  type Permission,
} from "./server";
import toast from "react-hot-toast";

const EMPTY_PERM = (menuId: string): Permission => ({
  menuId,
  isEnable: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
});

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [permList, setPermList] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoles().then(setRoles).catch(() => {});
    fetchMenus().then(setMenus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedRole) { setPermList([]); return; }
    setLoading(true);
    fetchPermissions(selectedRole)
      .then(setPermList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedRole]);

  const getPermForMenu = (menuId: string): Permission =>
    permList.find((p) => p.menuId === menuId) ?? EMPTY_PERM(menuId);

  const toggle = (menuId: string, field: keyof Omit<Permission, "menuId">) => {
    setPermList((prev) => {
      const flipOne = (p: Permission): Permission => {
        const next = { ...p };
        next[field] = !next[field];
        return next;
      };
      const idx = prev.findIndex((p) => p.menuId === menuId);
      if (idx !== -1) {
        return prev.map((p) => (p.menuId === menuId ? flipOne(p) : p));
      }
      const fresh = flipOne(EMPTY_PERM(menuId));
      return [...prev, fresh];
    });
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const payload: Permission[] = menus.map((m) => getPermForMenu(m.id));
      await savePermissions(selectedRole, payload);
      toast.success("Permissions saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Permissions" subtitle="Manage role-based access control" />
      <div className="mb-5 flex items-center gap-4">
        <Select
          label="Select Role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          placeholder="Choose role..."
          options={roles.map((r) => ({ value: r.id, label: r.name }))}
          className="w-64"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          Loading permissions...
        </div>
      )}

      {selectedRole && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Menu</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Enable</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Create</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Edit</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {menus.map((m) => {
                const perm = getPermForMenu(m.id);
                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-gray-50 ${!m.parentMenu ? "bg-gray-50/60 font-medium" : ""}`}
                  >
                    <td className="px-4 py-2 text-gray-700">
                      {m.parentMenu
                        ? <span className="pl-5 text-gray-600">{m.menuName}</span>
                        : m.menuName}
                    </td>
                    {(["isEnable", "canCreate", "canEdit", "canDelete"] as const).map((field) => (
                      <td key={field} className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm[field]}
                          onChange={() => toggle(m.id, field)}
                          className="w-4 h-4 accent-primary-800"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              Save Permissions
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
