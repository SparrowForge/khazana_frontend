import React from "react";

/**
 * Passthrough wrapper kept for backwards-compatibility with the ~46 pages that
 * render `<AppLayout>…</AppLayout>`.
 *
 * The real shell — sidebar, main scroll area, auth/permission guard — now lives
 * in `AppShell`, mounted ONCE in the root `app/layout.tsx`. Keeping it in the
 * layout means the sidebar persists across navigation instead of remounting
 * (and refetching menus / losing expanded state) on every route change.
 *
 * Pages don't need to change; this just renders their content into AppShell's
 * already-padded `<main>`.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
