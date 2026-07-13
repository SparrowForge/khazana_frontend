// Domain API over IndexedDB for the offline POS engine. Everything here is
// namespaced by `userId` so two cashiers sharing one physical machine never see
// or mutate each other's parked offline sales or cached stock (Session Safeguard).

import {
  STORE_ORDERS, STORE_STOCK, STORE_META, STORE_CATALOG,
  idbGet, idbPut, idbDelete, idbGetAll,
} from "./idb";
import type { PosProduct } from "@/lib/services/pos.service";

/** Client-only display snapshot for printing the offline receipt (NOT synced). */
export interface OfflineDisplayLine {
  name: string;
  qty: number;
  rate: number;
  vatPct: number;
  vat: number;
  total: number;
}

/** Branch header snapshot, so an offline receipt prints the same letterhead
 *  (address / VAT Reg No / Mushak 6.3) as the online one. Cached at sale time
 *  because the terminal can't look the branch up while offline. */
export interface OfflineDisplayBranch {
  name?: string | null;
  address?: string | null;
  vatNo?: string | null;
  mobileNo?: string | null;
}

export interface OfflineDisplay {
  dateTime: string;
  servedBy: string;
  branch?: OfflineDisplayBranch;
  lines: OfflineDisplayLine[];
  subtotal: number;
  vatAmount: number;
  discountAmount: number;
  payableAmount: number;
  paidAmount: number;
  changeAmount: number;
}

/** A sale completed offline, awaiting sync. */
export interface OfflineOrder {
  localId: string;
  userId: string;
  // ── Fields that get uploaded to POST /pos/sync-offline (OfflineSaleDto) ──
  invoiceNo: string;
  items: { itemId: string; qty: number }[];
  paidAmount: number;
  clientSavedAt: string;
  servedBy?: string;
  salesType?: string;
  /** Bank UUID — set when salesType is 'Card'. */
  bankId?: string;
  /** Originating branch UUID captured at sale time. */
  branchId?: string;
  discountType?: "fixed" | "percentage";
  discountValue?: number;
  /** Discount authoriser name/contact — captured when a discount is applied. */
  discountRemarks?: string;
  discountContact?: string;
  // ── Client-only ──
  display: OfflineDisplay;
}

interface StockRow {
  key: string; // `${userId}:${itemId}`
  userId: string;
  itemId: string;
  quantity: number;
  cachedAt: string;
}

interface MetaRow {
  key: string;
  value: number;
}

const stockKey = (userId: string, itemId: string) => `${userId}:${itemId}`;
const seqKey = (userId: string) => `seq:${userId}`;

// ── Offline order queue ───────────────────────────────────────────────

export async function addOfflineOrder(order: OfflineOrder): Promise<void> {
  await idbPut(STORE_ORDERS, order);
}

export async function getOfflineOrders(userId: string): Promise<OfflineOrder[]> {
  const all = await idbGetAll<OfflineOrder>(STORE_ORDERS, { name: "byUser", value: userId });
  // Oldest first so replay roughly follows sale order.
  return all.sort((a, b) => a.clientSavedAt.localeCompare(b.clientSavedAt));
}

export async function removeOfflineOrders(localIds: string[]): Promise<void> {
  await Promise.all(localIds.map((id) => idbDelete(STORE_ORDERS, id)));
}

// ── Per-user offline sequence ─────────────────────────────────────────

export async function nextSequence(userId: string): Promise<number> {
  const row = await idbGet<MetaRow>(STORE_META, seqKey(userId));
  const next = (row?.value ?? 0) + 1;
  await idbPut<MetaRow>(STORE_META, { key: seqKey(userId), value: next });
  return next;
}

// ── Cached stock (per-user) ───────────────────────────────────────────

export async function cacheStock(
  userId: string,
  items: { itemId: string; quantity: number }[],
): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all(
    items.map((i) =>
      idbPut<StockRow>(STORE_STOCK, {
        key: stockKey(userId, i.itemId),
        userId,
        itemId: i.itemId,
        quantity: i.quantity,
        cachedAt: now,
      }),
    ),
  );
}

export async function getCachedStock(userId: string): Promise<Record<string, number>> {
  const rows = await idbGetAll<StockRow>(STORE_STOCK).catch(() => [] as StockRow[]);
  const map: Record<string, number> = {};
  for (const r of rows) if (r.userId === userId) map[r.itemId] = r.quantity;
  return map;
}

/** Instantly decrement the local stock copy so the cashier sees live counts. */
export async function deductCachedStock(
  userId: string,
  items: { itemId: string; qty: number }[],
): Promise<void> {
  await Promise.all(
    items.map(async (i) => {
      const key = stockKey(userId, i.itemId);
      const row = await idbGet<StockRow>(STORE_STOCK, key);
      if (!row) return; // not cached → nothing to deduct locally
      await idbPut<StockRow>(STORE_STOCK, { ...row, quantity: row.quantity - i.qty });
    }),
  );
}

// ── Product catalog snapshot (for cold-offline boot) ──────────────────

interface CatalogRow {
  key: string; // userId
  products: PosProduct[];
  cachedAt: string;
}

export async function cacheCatalog(userId: string, products: PosProduct[]): Promise<void> {
  await idbPut<CatalogRow>(STORE_CATALOG, {
    key: userId,
    products,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedCatalog(userId: string): Promise<PosProduct[]> {
  const row = await idbGet<CatalogRow>(STORE_CATALOG, userId).catch(() => undefined);
  return row?.products ?? [];
}

/** Strip an OfflineOrder down to the exact OfflineSaleDto the backend accepts —
 *  drops localId/userId/display so the strict whitelist DTO won't 400. */
export function toSyncPayload(o: OfflineOrder) {
  return {
    invoiceNo: o.invoiceNo,
    items: o.items,
    paidAmount: o.paidAmount,
    clientSavedAt: o.clientSavedAt,
    ...(o.servedBy ? { servedBy: o.servedBy } : {}),
    ...(o.salesType ? { salesType: o.salesType } : {}),
    ...(o.bankId ? { bankId: o.bankId } : {}),
    ...(o.branchId != null ? { branchId: o.branchId } : {}),
    ...(o.discountType ? { discountType: o.discountType } : {}),
    ...(o.discountValue ? { discountValue: o.discountValue } : {}),
    ...(o.discountRemarks ? { discountRemarks: o.discountRemarks } : {}),
    ...(o.discountContact ? { discountContact: o.discountContact } : {}),
  };
}
