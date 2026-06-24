"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import {
  fetchUsers,
  fetchRoles,
  buildPermissionsFromRoles,
  assignRolesToUsers,
  type UserItem,
  type Role,
} from "./server";
import toast from "react-hot-toast";

export default function UserRolePermissionsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers().then((all) => setUsers(all.filter((u) => u.isActive === "Y"))).catch(() => {});
    fetchRoles().then(setRoles).catch(() => {});
  }, []);

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.userName.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const toggleUser = (userName: string) =>
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      next.has(userName) ? next.delete(userName) : next.add(userName);
      return next;
    });

  const allVisibleSelected = visibleUsers.length > 0 && visibleUsers.every((u) => selectedUsers.has(u.userName));
  const toggleAllVisible = () =>
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleUsers.forEach((u) => next.delete(u.userName));
      else visibleUsers.forEach((u) => next.add(u.userName));
      return next;
    });

  const toggleRole = (roleId: string) =>
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      next.has(roleId) ? next.delete(roleId) : next.add(roleId);
      return next;
    });

  const handleSave = async () => {
    const userNames = Array.from(selectedUsers);
    const roleIds = Array.from(selectedRoles);
    if (userNames.length === 0) {
      toast.error("Select at least one user");
      return;
    }
    if (roleIds.length === 0) {
      toast.error("Select at least one role to assign");
      return;
    }
    setSaving(true);
    try {
      const permissions = await buildPermissionsFromRoles(roleIds);
      await assignRolesToUsers(userNames, permissions);
      toast.success(`Assigned ${roleIds.length} role(s) to ${userNames.length} user(s)`);
    } catch {
      toast.error("Failed to assign roles");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between">
        <PageHeader
          title="User Role Permission"
          subtitle="Assign one or more system roles to one or more users"
        />
        <Button onClick={handleSave} loading={saving}>
          Assign Roles
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-4">
        {/* ---------------- Left: searchable user selection grid ---------------- */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-700">Users</h3>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-800 focus:outline-none focus:ring-1 focus:ring-primary-800"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-center w-12">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="w-4 h-4 accent-primary-800"
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">User Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-xs">
                      No users match the search.
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map((u) => (
                    <tr
                      key={u.userName}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleUser(u.userName)}
                    >
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(u.userName)}
                          onChange={() => toggleUser(u.userName)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-primary-800"
                        />
                      </td>
                      <td className="px-4 py-2 text-gray-700">{u.userName}</td>
                      <td className="px-4 py-2 text-gray-600">{u.name ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t text-xs text-gray-500">
            {selectedUsers.size} user(s) selected
          </div>
        </div>

        {/* ---------------- Right: multi-select roles panel ---------------- */}
        <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-700">System Roles</h3>
            <p className="text-xs text-gray-500 mt-0.5">Select roles to assign to the chosen users</p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
            {roles.length === 0 ? (
              <p className="px-2 py-6 text-center text-gray-400 text-xs">No roles found.</p>
            ) : (
              roles.map((r) => (
                <label
                  key={r.id}
                  className="flex items-start gap-2 px-2 py-2 rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.has(r.id)}
                    onChange={() => toggleRole(r.id)}
                    className="mt-0.5 w-4 h-4 accent-primary-800"
                  />
                  <span>
                    <span className="block text-sm text-gray-700">{r.name}</span>
                    {r.description && <span className="block text-xs text-gray-400">{r.description}</span>}
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="px-4 py-2 border-t text-xs text-gray-500">
            {selectedRoles.size} role(s) selected
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
