"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  fetchUsers,
  fetchMenus,
  fetchRoles,
  getUserPermissions,
  importRoleTemplate,
  saveUserPermissions,
  type UserItem,
  type Menu,
  type Role,
  type UserPermission,
} from "./server";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

type PermFlag = "isEnable" | "addAccess" | "editAccess" | "deleteAccess";
const FLAG_COLS: { key: PermFlag; label: string }[] = [
  { key: "isEnable", label: "Access" },
  { key: "addAccess", label: "Insert" },
  { key: "editAccess", label: "Update" },
  { key: "deleteAccess", label: "Delete" },
];

const MODULES = ["Sale", "Purchase", "Inventory"] as const;

const EMPTY_PERM = (controlName: string): UserPermission => ({
  controlName,
  isEnable: "N",
  addAccess: "N",
  editAccess: "N",
  deleteAccess: "N",
});

export default function UserPermissionsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Left panel: build a set of target users, each individually selectable.
  const [pickUser, setPickUser] = useState<string>("");
  const [assigned, setAssigned] = useState<UserItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Right panel: the permission grid (keyed by menu controlName) + filters.
  const [perms, setPerms] = useState<Record<string, UserPermission>>({});
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [roleToImport, setRoleToImport] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers().then((all) => setUsers(all.filter((u) => u.isActive === "Y"))).catch(() => {});
    fetchMenus().then(setMenus).catch(() => {});
    fetchRoles().then(setRoles).catch(() => {});
  }, []);

  const getPerm = (controlName: string): UserPermission =>
    perms[controlName] ?? EMPTY_PERM(controlName);

  const visibleMenus = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menus.filter((m) => {
      if (moduleFilter && m.module !== moduleFilter) return false;
      if (!q) return true;
      return (
        m.menuName.toLowerCase().includes(q) ||
        m.controlName.toLowerCase().includes(q) ||
        (m.parentMenu ?? "").toLowerCase().includes(q)
      );
    });
  }, [menus, moduleFilter, search]);

  // --- User assignment ---------------------------------------------------
  const addUser = () => {
    if (!pickUser) return;
    const u = users.find((x) => x.userName === pickUser);
    if (!u || assigned.some((a) => a.userName === u.userName)) return;
    const next = [...assigned, u];
    setAssigned(next);
    setSelected((prev) => new Set(prev).add(u.userName));
    setPickUser("");
    // Convenience: when this is the only target, load their existing grid so an
    // admin editing one user sees current state. Multi-user keeps the grid as a template.
    if (next.length === 1) loadGrid(u.userName);
  };

  const loadGrid = (userName: string) => {
    getUserPermissions(userName)
      .then((list) => {
        const map: Record<string, UserPermission> = {};
        list.forEach((p) => (map[p.controlName] = p));
        setPerms(map);
      })
      .catch(() => {});
  };

  const toggleSelected = (userName: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userName)) next.delete(userName);
      else next.add(userName);
      return next;
    });

  const allSelected = assigned.length > 0 && selected.size === assigned.length;
  const toggleAllUsers = () =>
    setSelected(allSelected ? new Set() : new Set(assigned.map((a) => a.userName)));

  // --- Grid editing ------------------------------------------------------
  const toggleCell = (controlName: string, flag: PermFlag) =>
    setPerms((prev) => {
      const cur = prev[controlName] ?? EMPTY_PERM(controlName);
      return { ...prev, [controlName]: { ...cur, [flag]: cur[flag] === "Y" ? "N" : "Y" } };
    });

  // Master toggle: turn a column (or every column) on/off for all visible menus.
  const toggleColumn = (flag: PermFlag | "all") =>
    setPerms((prev) => {
      const next = { ...prev };
      const flags: PermFlag[] = flag === "all" ? FLAG_COLS.map((c) => c.key) : [flag];
      // If everything targeted is already on, flip the whole batch off.
      const allOn = visibleMenus.every((m) =>
        flags.every((f) => (next[m.controlName]?.[f] ?? "N") === "Y"),
      );
      const value = allOn ? "N" : "Y";
      visibleMenus.forEach((m) => {
        const cur = next[m.controlName] ?? EMPTY_PERM(m.controlName);
        const updated = { ...cur };
        flags.forEach((f) => (updated[f] = value));
        next[m.controlName] = updated;
      });
      return next;
    });

  const importRole = async () => {
    if (!roleToImport) return;
    try {
      const tpl = await importRoleTemplate(roleToImport);
      const map: Record<string, UserPermission> = {};
      tpl.forEach((p) => p.controlName && (map[p.controlName] = p));
      setPerms(map);
      toast.success("Role template imported into grid");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to import role"));
    }
  };

  const clearGrid = () => setPerms({});

  const handleSave = async () => {
    const targets = assigned.filter((a) => selected.has(a.userName)).map((a) => a.userName);
    if (targets.length === 0) {
      toast.error("Select at least one user to update");
      return;
    }
    setSaving(true);
    try {
      // Send the full grid for every menu so the save replaces each user's set completely.
      const payload = menus.map((m) => getPerm(m.controlName));
      // PUT /users/{userName}/permissions per selected user (delete-then-insert t_UserRole).
      await Promise.all(targets.map((userName) => saveUserPermissions(userName, payload)));
      toast.success(`Permissions updated for ${targets.length} user(s)`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save permissions"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between">
        <PageHeader
          title="User Menu Permission"
          subtitle="Assign module & menu access directly to one or more users"
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={clearGrid}>
            Clear
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Update
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-4">
        {/* ---------------- Left: User selection ---------------- */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-lg border border-sage-300 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">User Selection</h3>
            <div className="flex items-end gap-2">
              <Select
                label="User"
                value={pickUser}
                onChange={(e) => setPickUser(e.target.value)}
                placeholder="Select user..."
                options={users
                  .filter((u) => !assigned.some((a) => a.userName === u.userName))
                  .map((u) => ({
                    value: u.userName,
                    label: u.name ? `${u.name} (${u.userName})` : u.userName,
                  }))}
                className="flex-1"
              />
              <Button size="sm" onClick={addUser} disabled={!pickUser}>
                Add User
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-sage-300 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-gray-700">Assigned User Table</h3>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAllUsers}
                  className="w-4 h-4 accent-primary-800"
                />
                Check All Users
              </label>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-sage-100 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">User Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 w-16">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200">
                {assigned.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-xs">
                      No users assigned yet.
                    </td>
                  </tr>
                ) : (
                  assigned.map((u) => (
                    <tr key={u.userName} className="hover:bg-sage-100">
                      <td className="px-4 py-2 text-gray-700">{u.userName}</td>
                      <td className="px-4 py-2 text-gray-600">{u.name ?? "—"}</td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(u.userName)}
                          onChange={() => toggleSelected(u.userName)}
                          className="w-4 h-4 accent-primary-800"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------- Right: Module & Menu permission matrix ---------------- */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-sage-300 overflow-hidden">
          <div className="px-4 py-3 border-b space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Module &amp; Menu Permission</h3>
            <div className="flex flex-wrap items-end gap-3">
              <Select
                label="Module"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                placeholder="All modules"
                options={MODULES.map((m) => ({ value: m, label: m }))}
                className="w-44"
              />
              <Select
                label="Import Role"
                value={roleToImport}
                onChange={(e) => setRoleToImport(e.target.value)}
                placeholder="Select role..."
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
                className="w-48"
              />
              <Button size="sm" variant="secondary" onClick={importRole} disabled={!roleToImport}>
                Import
              </Button>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menus..."
                className="ml-auto w-56 rounded-md border border-sage-400 px-3 py-2 text-sm focus:border-primary-800 focus:outline-none focus:ring-1 focus:ring-primary-800"
              />
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-sage-100 border-b sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Module</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Main Menu</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    <div className="flex items-center justify-between gap-2">
                      <span>Menu Name</span>
                      <button
                        onClick={() => toggleColumn("all")}
                        className="font-medium text-primary-800 hover:underline"
                      >
                        All
                      </button>
                    </div>
                  </th>
                  {FLAG_COLS.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                      <button onClick={() => toggleColumn(c.key)} className="hover:underline">
                        {c.label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200">
                {visibleMenus.length === 0 ? (
                  <tr>
                    <td colSpan={3 + FLAG_COLS.length} className="px-4 py-6 text-center text-gray-400 text-xs">
                      No menus match the current filter.
                    </td>
                  </tr>
                ) : (
                  visibleMenus.map((m) => {
                    const perm = getPerm(m.controlName);
                    return (
                      <tr key={m.id} className="hover:bg-sage-100">
                        <td className="px-3 py-2 text-gray-500">{m.module ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{m.parentMenu ?? m.menuName}</td>
                        <td className="px-3 py-2 text-gray-700">{m.menuName}</td>
                        {FLAG_COLS.map(({ key }) => (
                          <td key={key} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={perm[key] === "Y"}
                              onChange={() => toggleCell(m.controlName, key)}
                              className="w-4 h-4 accent-primary-800"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
