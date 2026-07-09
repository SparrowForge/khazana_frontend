"use client";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogOut, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

function NavLinkRow({ link, collapsed }: { link: RenderLink; collapsed: boolean }) {
  const pathname = usePathname();
  return (
    <Link
      href={link.href}
      title={collapsed ? link.label : undefined}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
        collapsed && "justify-center px-2",
        pathname === link.href
          ? "bg-primary-800 text-white"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
      )}
    >
      {link.icon}
      {!collapsed && <span>{link.label}</span>}
    </Link>
  );
}

function NavGroup({
  label,
  icon,
  links,
  collapsed,
}: {
  label: string;
  icon: React.ReactNode;
  links: RenderLink[];
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isChildActive = links.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));
  const [open, setOpen] = useState(isChildActive);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Click-to-open flyout (not hover) so it works on touch/mobile too. Portaled
  // to <body> and fixed-positioned because the sidebar's overflow-y-auto
  // otherwise clips anything that pokes past its right edge.
  useEffect(() => {
    if (!flyoutOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(target) &&
        btnRef.current &&
        !btnRef.current.contains(target)
      ) {
        setFlyoutOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFlyoutOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [flyoutOpen]);

  const toggleFlyout = () => {
    if (!flyoutOpen) {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setFlyoutPos({ top: rect.top, left: rect.right + 4 });
    }
    setFlyoutOpen((v) => !v);
  };

  if (collapsed) {
    return (
      <div className="relative">
        <button
          ref={btnRef}
          title={label}
          aria-haspopup="menu"
          aria-expanded={flyoutOpen}
          onClick={toggleFlyout}
          className={cn(
            "w-full flex items-center justify-center px-2 py-2 rounded-md text-sm transition-colors",
            isChildActive || flyoutOpen
              ? "text-white bg-slate-700"
              : "text-slate-300 hover:bg-slate-700 hover:text-white"
          )}
        >
          {icon}
        </button>
        {flyoutOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={flyoutRef}
              role="menu"
              style={{ position: "fixed", top: flyoutPos.top, left: flyoutPos.left }}
              className="z-50 min-w-[170px] rounded-md border border-slate-700 bg-slate-800 py-1 shadow-lg"
            >
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-400">{label}</div>
              {links.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setFlyoutOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                    pathname === child.href
                      ? "bg-primary-800 text-white"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  )}
                >
                  {child.icon}
                  <span>{child.label}</span>
                </Link>
              ))}
            </div>,
            document.body
          )}
      </div>
    );
  }

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

const SIDEBAR_COLLAPSED_KEY = "khazana-sidebar-collapsed";
const MOBILE_BREAKPOINT = 768;

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [menus, setMenus] = useState<NavMenu[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetchNavMenus().then(setMenus).catch(() => setMenus([]));
  }, []);

  // Default: honour a saved preference; otherwise collapse on mobile viewports.
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setCollapsed(stored === "true");
    } else if (window.innerWidth < MOBILE_BREAKPOINT) {
      setCollapsed(true);
    }
  }, []);

  // Auto-collapse when the viewport narrows into mobile range.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < MOBILE_BREAKPOINT) setCollapsed(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const items = buildNav(menus, user?.permissions ?? []);

  return (
    <aside
      className={cn(
        "h-screen bg-slate-800 flex flex-col overflow-y-auto shrink-0 transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-slate-700 py-4",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-white font-bold text-lg truncate">Khazana POS</h1>
            <p className="text-slate-400 text-xs mt-0.5 truncate">{user?.branchName ?? "Branch"}</p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className={cn("flex-1 py-3 space-y-0.5", collapsed ? "px-1.5" : "px-2")}>
        {items.map((item) =>
          item.kind === "link" ? (
            <NavLinkRow key={item.href} link={item} collapsed={collapsed} />
          ) : (
            <NavGroup
              key={item.label}
              label={item.label}
              icon={item.icon}
              links={item.children}
              collapsed={collapsed}
            />
          )
        )}
      </nav>

      <div className={cn("border-t border-slate-700 py-3", collapsed ? "px-1.5" : "px-2")}>
        <UserMenu collapsed={collapsed} />
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "mt-2 flex items-center gap-2 text-slate-400 hover:text-white text-xs transition-colors",
            collapsed ? "justify-center w-full py-1" : "px-2"
          )}
        >
          <LogOut size={14} />
          {!collapsed && "Logout"}
        </button>
      </div>
    </aside>
  );
}
