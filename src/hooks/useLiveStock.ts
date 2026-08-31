"use client";

import { useCallback, useEffect, useRef } from "react";
import { fetchStockLevels } from "@/lib/services/inventory.service";
import { useStockChanged } from "@/lib/stockEvents";

/** How often an idle, visible screen re-reads stock. Short enough that a till
 *  isn't quoting numbers from a minute ago, long enough to stay cheap — the
 *  endpoint is one small row per item. */
const DEFAULT_INTERVAL_MS = 30_000;

interface Options {
  /** Set false to hold the polling (an offline terminal has nothing to ask). */
  enabled?: boolean;
  intervalMs?: number;
}

/**
 * Keep a screen's on-hand numbers live.
 *
 * The stock a POS terminal or a credit-sale form shows is the thing it refuses
 * lines on, and it moves constantly from places this browser can't see: another
 * till ringing a sale, the factory issuing goods, a receive, an NC, a stock
 * adjustment. `useStockChanged` alone only ever hears *this* browser's own
 * mutations, so on top of that signal this hook re-reads the levels
 *
 *   • on a timer, while the tab is visible and online;
 *   • the moment the tab is looked at again (focus / visibilitychange) — the
 *     usual case, since a terminal sits untouched between customers; and
 *   • when the connection comes back.
 *
 * `apply` is handed the fresh `{ itemId: quantity }` map. It is held in a ref,
 * so an inline arrow redefined every render costs nothing. Returns `refresh()`
 * for the odd caller that wants to force a read.
 */
export function useLiveStock(
  apply: (levels: Record<string, number>) => void | Promise<void>,
  { enabled = true, intervalMs = DEFAULT_INTERVAL_MS }: Options = {},
) {
  const applyRef = useRef(apply);
  useEffect(() => { applyRef.current = apply; });

  // One read at a time: a slow response on a poor line must not stack up
  // requests, and two in-flight reads could apply out of order.
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    inFlight.current = true;
    try {
      const levels = await fetchStockLevels();
      await applyRef.current(levels);
    } catch {
      // Transient — the next tick (or the next glance at the tab) retries. The
      // screen keeps the numbers it has rather than blanking them.
    } finally {
      inFlight.current = false;
    }
  }, []);

  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; });

  // A mutation in this browser (or another of its tabs) is known immediately,
  // so it doesn't wait for the timer.
  useStockChanged(() => { if (enabledRef.current) void refresh(); });

  useEffect(() => {
    if (!enabled) return;
    const readIfVisible = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(readIfVisible, intervalMs);
    window.addEventListener("focus", readIfVisible);
    window.addEventListener("online", readIfVisible);
    document.addEventListener("visibilitychange", readIfVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", readIfVisible);
      window.removeEventListener("online", readIfVisible);
      document.removeEventListener("visibilitychange", readIfVisible);
    };
  }, [enabled, intervalMs, refresh]);

  return refresh;
}
