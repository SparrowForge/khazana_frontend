"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  fetchUsers,
  fetchMenus,
  getUserPermissions,
  saveUserPermissions,
  type UserItem,
  type Menu,
  type UserPermission,
} from "./server";
import toast from "react-hot-toast";

type PermFlag = "isEnable" | "addAccess" | "editAccess" | "deleteAccess";
const FLAG_COLS: { key: PermFlag; label: string }[] = [
  { key: "isEnable",    label: "Enable" },
  { key: "addAccess",   label: "Add"    },
  { key: "editAccess",  label: "Edit"   },
  { key: "deleteAccess",label: "Delete" },
];

const EMPTY_PERM = (controlName: string): UserPermission => ({
  controlName,
  isEnable:     "N",
  addAccess:    "N",
  editAccess:   "N",
  deleteAccess: "N",
});

export default function UserPermissionsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [permList, setPermList] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers().then((all) => setUsers(all.filter((u) => u.isActive === "Y"))).catch(() => {});
    fetchMenus().then(setMenus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedUser) { setPermList([]); return; }
    setLoading(true);
    getUserPermissions(selectedUser)
      .then(setPermList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedUser]);

  const getPermForMenu = (controlName: string): UserPermission =>
    permList.find((p) => p.controlName === controlName) ?? EMPTY_PERM(controlName);

  const toggle = (controlName: string, flag: PermFlag) => {
    setPermList((prev) => {
      const flip = (p: UserPermission): UserPermission => {
        const next = { ...p };
        next[flag] = next[flag] === "Y" ? "N" : "Y";
        return next;
      };
      const idx = prev.findIndex((p) => p.controlName === controlName);
      if (idx !== -1) {
        return prev.map((p) => (p.controlName === controlName ? flip(p) : p));
      }
      return [...prev, flip(EMPTY_PERM(controlName))];
    });
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const payload = menus.map((m) => getPermForMenu(m.controlName));
      await saveUserPermissions(selectedUser, payload);
      toast.success("Permissions saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="User Role Permission"
        subtitle="Assign menu-level access directly to a user"
      />

      <div className="mb-5">
        <Select
          label="Select User"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          placeholder="Choose user..."
          options={users.map((u) => ({
            value: u.userName,
            label: u.name ? `${u.name} (${u.userName})` : u.userName,
          }))}
          className="w-80"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          Loading permissions...
        </div>
      )}

      {selectedUser && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-1/2">
                  Menu
                </th>
                {FLAG_COLS.map((c) => (
                  <th
                    key={c.key}
                    className="px-4 py-3 text-center text-xs font-semibold text-gray-600"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {menus.map((m) => {
                const perm = getPermForMenu(m.controlName);
                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-gray-50 ${!m.parentMenu ? "bg-gray-50/60 font-medium" : ""}`}
                  >
                    <td className="px-4 py-2 text-gray-700">
                      {m.parentMenu ? (
                        <span className="pl-5 text-gray-600">{m.menuName}</span>
                      ) : (
                        m.menuName
                      )}
                    </td>
                    {FLAG_COLS.map(({ key }) => (
                      <td key={key} className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm[key] === "Y"}
                          onChange={() => toggle(m.controlName, key)}
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
