"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import type { UserPermission } from "@/types";
import { fetchNavMenus, type NavMenu } from "@/lib/services/menu.service";
import { NAV_REGISTRY } from "@/lib/navRegistry";
import UserMenu from "./UserMenu";

interface RenderLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

type RenderItem =
  | ({ kind: "link" } & RenderLink)
  | { kind: "group"; label: string; icon: React.ReactNode; children: RenderLink[] };

function isEnabled(controlName: string, permissions: UserPermission[]): boolean {
  const perm = permissions.find((p) => p.controlName === controlName);
  return perm?.isEnable === "Y";
}

/**
 * Build the navigation from DB menus (which top-level groups appear + order +
 * label + permission controlName) joined with the frontend registry (icons +
 * leaf links). Each item is permission-filtered using the user's permissions.
 */
function buildNav(menus: NavMenu[], permissions: UserPermission[]): RenderItem[] {
  const topLevel = menus
    .filter((m) => !m.parentMenu)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const items: RenderItem[] = [];
  for (const menu of topLevel) {
    const meta = NAV_REGISTRY[menu.controlName];
    if (!meta) continue; // DB row with no frontend mapping → skip

    if (meta.route) {
      // Direct top-level link: gate on its own control.
      if (!isEnabled(menu.controlName, permissions)) continue;
      items.push({ kind: "link", label: menu.menuName, href: meta.route, icon: meta.icon });
      continue;
    }

    if (meta.links) {
      // Group: show it if ANY child is permitted. Each child is gated by its own
      // controlName (falling back to the group's), so granting just a leaf
      // permission (e.g. POSSales) surfaces the group even without the parent.
      const children = meta.links
        .filter((l) => isEnabled(l.controlName ?? menu.controlName, permissions))
        .map((l) => ({ label: l.label, href: l.route, icon: l.icon }));
      if (children.length > 0) {
        items.push({ kind: "group", label: menu.menuName, icon: meta.icon, children });
      }
    }
  }
  return items;
}

function NavLinkRow({ link }: { link: RenderLink }) {
  const pathname = usePathname();
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
        pathname === link.href
          ? "bg-primary-800 text-white"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
      )}
    >
      {link.icon}
      <span>{link.label}</span>
    </Link>
  );
}

function NavGroup({ label, icon, links }: { label: string; icon: React.ReactNode; links: RenderLink[] }) {
  const pathname = usePathname();
  const isChildActive = links.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));
  const [open, setOpen] = useState(isChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
          isChildActive ? "text-white bg-slate-700" : "text-slate-300 hover:bg-slate-700 hover:text-white"
        )}
      >
        <span className="flex items-center gap-2">{icon}{label}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-600 pl-2">
          {links.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
                pathname === child.href
                  ? "bg-primary-800 text-white"
                  : "text-slate-400 hover:bg-slate-700 hover:text-white"
              )}
            >
              {child.icon}
              <span>{child.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [menus, setMenus] = useState<NavMenu[]>([]);

  useEffect(() => {
    fetchNavMenus().then(setMenus).catch(() => setMenus([]));
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const items = buildNav(menus, user?.permissions ?? []);

  return (
    <aside className="h-screen w-60 bg-slate-800 flex flex-col overflow-y-auto shrink-0">
      <div className="px-4 py-4 border-b border-slate-700">
        <h1 className="text-white font-bold text-lg">Khazana POS</h1>
        <p className="text-slate-400 text-xs mt-0.5">{user?.branchName ?? "Branch"}</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((item) =>
          item.kind === "link" ? (
            <NavLinkRow key={item.href} link={item} />
          ) : (
            <NavGroup key={item.label} label={item.label} icon={item.icon} links={item.children} />
          )
        )}
      </nav>

      <div className="px-2 py-3 border-t border-slate-700">
        <UserMenu />
        <button
          onClick={handleLogout}
          className="mt-2 flex items-center gap-2 px-2 text-slate-400 hover:text-white text-xs transition-colors"
        >
          <LogOut size={14} /> Logout
        </button>
      </div>
    </aside>
  );
}
