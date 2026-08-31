"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth.store";
import { posSalesApi, type SyncOfflineResult } from "@/lib/services/pos.service";
import {
  getOfflineOrders, removeOfflineOrders, toSyncPayload,
} from "@/lib/offline/offlineStore";
import { emitStockChanged } from "@/lib/stockEvents";

/**
 * Watches connectivity and drains the current user's offline order queue back to
 * the central DB when the connection returns. Safe to mount once on the POS page.
 *
 * - `isOnline`    — live `navigator.onLine` state.
 * - `pendingCount`— how many offline orders are queued for this user.
 * - `syncing`     — a flush is in flight.
 * - `syncNow()`   — manually trigger a flush.
 * - `refresh()`   — recompute `pendingCount` (call after saving a new offline sale).
 */
export function useOfflineSync() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const userName = user?.userName ?? null;

  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId) return setPendingCount(0);
    try {
      const orders = await getOfflineOrders(userId);
      setPendingCount(orders.length);
    } catch {
      /* IndexedDB unavailable — leave count as-is */
    }
  }, [userId]);

  const syncNow = useCallback(async (): Promise<SyncOfflineResult | null> => {
    if (!userId || !userName) return null;
    if (syncingRef.current) return null; // guard against overlapping flushes

    const orders = await getOfflineOrders(userId).catch(() => []);
    if (!orders.length) return null;

    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await posSalesApi.syncOffline({
        userId,
        userName,
        orders: orders.map(toSyncPayload),
      });

      // Drop everything the server accepted (synced) or already had (skipped).
      // Anything that failed stays queued for the next attempt.
      const clearable = new Set(
        result.results.filter((r) => r.status !== "failed").map((r) => r.invoiceNo),
      );
      const toRemove = orders.filter((o) => clearable.has(o.invoiceNo)).map((o) => o.localId);
      await removeOfflineOrders(toRemove);

      if (result.syncedCount > 0) toast.success(`Synced ${result.syncedCount} offline sale(s)`);
      if (result.failedCount > 0) toast.error(`${result.failedCount} offline sale(s) failed to sync`);

      await refresh();
      // The queue is drained and those sales are now the server's: screens
      // watching stock can safely re-read it (they subtract anything still
      // queued, so this has to come after the removal above).
      emitStockChanged("pos-sale:sync-offline");
      return result;
    } catch {
      toast.error("Sync failed — will retry when online");
      return null;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [userId, userName, refresh]);

  // Initial state + count.
  useEffect(() => {
    if (typeof navigator !== "undefined") setIsOnline(navigator.onLine);
    refresh();
  }, [refresh]);

  // React to connectivity changes; flush automatically on reconnect.
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      void syncNow();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncNow]);

  return { isOnline, pendingCount, syncing, syncNow, refresh };
}
