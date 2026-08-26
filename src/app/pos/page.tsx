"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Image from "next/image";
import toast from "react-hot-toast";
import { posProductsApi, posSalesApi, posBanksApi, POS_PAY_MODES, type PosProduct, type PosBank } from "@/lib/services/pos.service";
import { adminService, type Branch } from "@/lib/services/admin.service";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import {
  addOfflineOrder, deductCachedStock, cacheStock, cacheCatalog,
  getCachedCatalog, getCachedStock, nextSequence, type OfflineOrder,
} from "@/lib/offline/offlineStore";
import { buildOfflineInvoiceNo, fallbackPrefix } from "@/lib/offline/invoice";
import { printOfflineReceipt } from "@/lib/offline/receipt";
import { getErrorMessage } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import ItemQuickAddModal from "@/components/catalog/ItemQuickAddModal";
import {
  ShoppingCart, Plus, Minus, Trash2, Search, Tag, PauseCircle, Clock, X,
  Wifi, WifiOff, RefreshCw, PackagePlus,
} from "lucide-react";

interface CartItem {
  itemId: string;
  name: string;
  uom: string;
  price: number;
  vatPercentage: number;
  qty: number;
}

type DiscountType = "fixed" | "percentage";

/** A parked order snapshot held in the local queue (Hold/Resume). */
interface HeldOrder {
  id: string;
  heldAt: string;
  cart: CartItem[];
  servedBy: string;
  payMode: string;
  bankId: string;
  discountType: DiscountType;
  discountValue: string;
  discountName: string;
  discountContact: string;
}

const QUEUE_STORAGE_KEY = "pos.orderQueue.v1";
const BRANCH_STORAGE_KEY = "pos.branch.v1";

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toFixed(2);
/** Qty is decimal (2dp) for weight-priced items — show whole numbers cleanly. */
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const QTY_STEP = 0.01;
const MIN_QTY = 0.01;

/** Gross (incl. VAT, pre-discount) for a held order — used for queue display. */
const heldOrderGross = (h: HeldOrder) =>
  r2(h.cart.reduce((s, c) => s + c.price * c.qty + Math.round(c.price * c.qty * c.vatPercentage) / 100, 0));

const heldOrderQty = (h: HeldOrder) => h.cart.reduce((s, c) => s + c.qty, 0);

function heldTimeLabel(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PosPage() {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState("");
  const [servedBy, setServedBy] = useState("");
  const [payMode, setPayMode] = useState<string>("Cash");
  const [banks, setBanks] = useState<PosBank[]>([]);
  const [bankId, setBankId] = useState("");
  const [branch, setBranch] = useState<Branch | null>(null);
  /** In-flight text for the qty boxes, keyed by itemId. Held separately from the
   *  cart so a half-typed value ("1." / "") isn't parsed and clobbered on every
   *  keystroke; committed on blur/Enter. */
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Quick-add: put an item on the catalogue without leaving the till. Online
   *  only — a new item has to reach the server before it can be sold. */
  const [itemModal, setItemModal] = useState(false);
  const { can } = usePermissions();
  const canAddItem = can("Items", "add") && can("Pricing", "add");

  // Discount state
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState("");
  // Discount authoriser (mandatory when a discount is applied)
  const [discountName, setDiscountName] = useState("");
  const [discountContact, setDiscountContact] = useState("");

  // ── Order queue (Hold / Resume), persisted to localStorage ───
  const [queue, setQueue] = useState<HeldOrder[]>([]);
  const [queueHydrated, setQueueHydrated] = useState(false);

  // ── Offline-first state ──────────────────────────────────────
  const user = useAuthStore((s) => s.user);
  const { isOnline, pendingCount, syncing, syncNow, refresh: refreshPending } = useOfflineSync();

  // Load products: online → fetch + refresh local caches; offline → cached catalog.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await posProductsApi.getAll();
        if (cancelled) return;
        setProducts(data);
        if (user) {
          await cacheCatalog(user.id, data);
          await cacheStock(user.id, data.map((p) => ({ itemId: p.id, quantity: p.stock })));
        }
      } catch {
        if (!user) {
          if (!cancelled) toast.error("Failed to load products");
          return;
        }
        const [cat, stock] = await Promise.all([
          getCachedCatalog(user.id),
          getCachedStock(user.id),
        ]);
        if (cancelled) return;
        if (cat.length) {
          setProducts(cat.map((p) => ({ ...p, stock: stock[p.id] ?? p.stock })));
          toast("Loaded cached catalog (offline)", { icon: "📴" });
        } else {
          toast.error("No cached products available offline");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  /** Re-pull the catalogue after an item is added at the till, refreshing the
   *  offline caches the same way the initial load does. */
  const reloadProducts = async () => {
    try {
      const data = await posProductsApi.getAll();
      setProducts(data);
      if (user) {
        await cacheCatalog(user.id, data);
        await cacheStock(user.id, data.map((p) => ({ itemId: p.id, quantity: p.stock })));
      }
    } catch {
      toast.error("Item saved, but the product list didn't refresh");
    }
  };

  // Banks for the Card-payment dropdown (best-effort; offline terminals just
  // get an empty list and skip the bank selection).
  useEffect(() => {
    posBanksApi.getAll().then(setBanks).catch(() => {});
  }, []);

  // Session branch letterhead (address / VAT Reg No / tel). Kept in localStorage
  // so an offline receipt can still print the same header the online one does.
  useEffect(() => {
    if (!user?.branchId) return;
    try {
      const cached = localStorage.getItem(`${BRANCH_STORAGE_KEY}.${user.branchId}`);
      if (cached) setBranch(JSON.parse(cached) as Branch);
    } catch {
      /* corrupt/unavailable storage — fall back to the fetch below */
    }
    adminService
      .listBranches()
      .then((list) => {
        const mine = list.find((b) => String(b.id) === String(user.branchId));
        if (!mine) return;
        setBranch(mine);
        try {
          localStorage.setItem(`${BRANCH_STORAGE_KEY}.${user.branchId}`, JSON.stringify(mine));
        } catch {
          /* storage full/unavailable — non-fatal, receipt just omits the header */
        }
      })
      .catch(() => {
        /* offline or no access — the cached copy (if any) is already set */
      });
  }, [user?.branchId]);

  /** Reflect a sale in the on-screen stock counts (and not just the cache). */
  const decrementProductStock = (sold: CartItem[]) => {
    setProducts((prev) =>
      prev.map((p) => {
        const line = sold.find((c) => c.itemId === p.id);
        return line ? { ...p, stock: p.stock - line.qty } : p;
      }),
    );
  };

  // Load any parked orders that survived a refresh.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) setQueue(JSON.parse(raw) as HeldOrder[]);
    } catch {
      /* corrupt/unavailable storage — start with an empty queue */
    }
    setQueueHydrated(true);
  }, []);

  // Persist the queue whenever it changes (but only after hydration, so we
  // don't clobber stored orders with the empty initial state on first render).
  useEffect(() => {
    if (!queueHydrated) return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch {
      /* storage full/unavailable — non-fatal */
    }
  }, [queue, queueHydrated]);

  /** On-hand qty for an item, from the catalog the terminal is running on —
   *  server-fresh when online, the IndexedDB cache when offline. The cart is
   *  capped against it so a cashier can't ring up stock that isn't there; the
   *  server enforces the same rule again on the online path. */
  const stockOf = (itemId: string) => products.find((p) => p.id === itemId)?.stock ?? 0;

  const addToCart = (product: PosProduct) => {
    const inCart = cart.find((c) => c.itemId === product.id)?.qty ?? 0;
    if (r2(inCart + 1) > product.stock) {
      toast.error(`${product.name} — only ${fmtQty(product.stock)} in stock`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === product.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === product.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        {
          itemId: product.id,
          name: product.name,
          uom: product.uom,
          price: Number(product.price),
          vatPercentage: Number(product.vatPercentage),
          qty: 1,
        },
      ];
    });
  };

  /** +/- stepper. Rounds to 2dp so 0.1 + 0.2 style drift can't creep in. */
  const changeQty = (itemId: string, delta: number) => {
    const line = cart.find((c) => c.itemId === itemId);
    if (!line) return;
    const next = r2(line.qty + delta);
    const onHand = stockOf(itemId);
    if (delta > 0 && next > onHand) {
      toast.error(`${line.name} — only ${fmtQty(onHand)} in stock`);
      return;
    }
    setCart((prev) =>
      prev
        .map((c) => (c.itemId === itemId ? { ...c, qty: next } : c))
        .filter((c) => c.qty > 0)
    );
  };

  /** Commit a typed qty. Blank/invalid/<=0 — or more than is on hand — reverts to
   *  the previous value rather than silently dropping the line or clamping to a
   *  number the cashier didn't type; removal is an explicit action. */
  const commitQty = (itemId: string, raw: string) => {
    setQtyDraft((d) => {
      const next = { ...d };
      delete next[itemId];
      return next;
    });
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const wanted = Math.max(MIN_QTY, r2(parsed));
    const onHand = stockOf(itemId);
    if (wanted > onHand) {
      toast.error(`Only ${fmtQty(onHand)} in stock`);
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, qty: wanted } : c)),
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  };

  const itemSubtotal = (c: CartItem) => c.price * c.qty;
  const itemVat = (c: CartItem) =>
    Math.round(c.price * c.qty * c.vatPercentage) / 100;

  // ── Calculation ──────────────────────────────────────────────
  const subtotal = r2(cart.reduce((s, c) => s + itemSubtotal(c), 0));
  const vatAmount = r2(cart.reduce((s, c) => s + itemVat(c), 0));
  const grossAmount = r2(subtotal + vatAmount);

  const discVal = parseFloat(discountValue) || 0;
  const rawDiscount =
    discountType === "percentage"
      ? r2(grossAmount * discVal / 100)
      : r2(discVal);
  // Clamp: never exceed gross
  const discountAmount = Math.min(rawDiscount, grossAmount);

  const payableAmount = r2(grossAmount - discountAmount);
  const paid = parseFloat(paidAmount) || 0;
  const change = r2(paid - payableAmount);

  // Discount input validation hint
  const discountExceedsTotal =
    discountType === "fixed"
      ? discVal > grossAmount && grossAmount > 0
      : discVal > 100;

  // Clear the active billing terminal back to a blank, ready state.
  const resetWorkspace = () => {
    setCart([]);
    setPaidAmount("");
    setServedBy("");
    setPayMode("Cash");
    setBankId("");
    setDiscountType("fixed");
    setDiscountValue("");
    setDiscountName("");
    setDiscountContact("");
  };

  // ── Hold / Resume ────────────────────────────────────────────
  const holdOrder = () => {
    if (!cart.length) { toast.error("Nothing to hold"); return; }
    const held: HeldOrder = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      heldAt: new Date().toISOString(),
      cart,
      servedBy,
      payMode,
      bankId,
      discountType,
      discountValue,
      discountName,
      discountContact,
    };
    setQueue((q) => [held, ...q]);
    resetWorkspace();
    toast.success("Order held");
  };

  const resumeOrder = (id: string) => {
    const held = queue.find((h) => h.id === id);
    if (!held) return;
    // Swap: if the terminal has an active cart, park it so it isn't lost.
    setQueue((q) => {
      const remaining = q.filter((h) => h.id !== id);
      if (cart.length) {
        remaining.unshift({
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          heldAt: new Date().toISOString(),
          cart,
          servedBy,
          payMode,
          bankId,
          discountType,
          discountValue,
          discountName,
          discountContact,
        });
      }
      return remaining;
    });
    setCart(held.cart);
    setServedBy(held.servedBy);
    setPayMode(held.payMode ?? "Cash");
    setBankId(held.bankId ?? "");
    setDiscountType(held.discountType);
    setDiscountValue(held.discountValue);
    setDiscountName(held.discountName ?? "");
    setDiscountContact(held.discountContact ?? "");
    setPaidAmount("");
    toast.success("Order resumed");
  };

  const discardHeld = (id: string) => {
    setQueue((q) => q.filter((h) => h.id !== id));
  };

  /** Persist the current cart as an offline order (IndexedDB), deduct local
   *  stock, print a self-contained receipt, and reset the terminal. */
  const saveOfflineBill = async (printWin?: Window | null) => {
    if (!user) { toast.error("Not logged in — cannot save offline"); printWin?.close(); return; }

    const prefix = user.userPrefix || fallbackPrefix(user.userName);
    const seq = await nextSequence(user.id);
    const at = new Date();
    const invoiceNo = buildOfflineInvoiceNo(prefix, seq, at);
    const items = cart.map((c) => ({ itemId: c.itemId, qty: c.qty }));

    const order: OfflineOrder = {
      localId:
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      userId: user.id,
      invoiceNo,
      items,
      paidAmount: paid,
      clientSavedAt: at.toISOString(),
      servedBy: servedBy || undefined,
      salesType: payMode,
      bankId: payMode === "Card" ? (bankId || undefined) : undefined,
      branchId: user.branchId || undefined,
      discountType: discVal > 0 ? discountType : undefined,
      discountValue: discVal > 0 ? discVal : undefined,
      discountRemarks: discountAmount > 0 ? discountName.trim() : undefined,
      discountContact: discountAmount > 0 ? discountContact.trim() : undefined,
      display: {
        dateTime: at.toLocaleString(),
        servedBy: servedBy || user.name || user.userName,
        branch: branch
          ? {
              name: branch.branchName,
              address: branch.address,
              vatNo: branch.vatNo,
              mobileNo: branch.mobileNo,
            }
          : undefined,
        lines: cart.map((c) => ({
          name: c.name, qty: c.qty, rate: c.price,
          vatPct: c.vatPercentage, vat: itemVat(c), total: itemSubtotal(c),
        })),
        subtotal, vatAmount, discountAmount, payableAmount, paidAmount: paid, changeAmount: change,
      },
    };

    await addOfflineOrder(order);
    await deductCachedStock(user.id, items);
    decrementProductStock(cart);
    await refreshPending();
    toast.success(`Saved offline — ${invoiceNo}`);
    printOfflineReceipt(order, printWin);
    resetWorkspace();
  };

  const handleGenerateBill = async () => {
    if (!cart.length) { toast.error("Cart is empty"); return; }
    // Re-checked at bill time as well as at add time: a resumed held order, or
    // one built before another sale landed, can hold qty that is no longer
    // available. This is the only stock gate on the offline path.
    const short = cart.filter((c) => c.qty > stockOf(c.itemId));
    if (short.length) {
      toast.error(
        `Not enough stock: ${short.map((c) => `${c.name} (${fmtQty(stockOf(c.itemId))} left)`).join(", ")}`,
      );
      return;
    }
    if (paid < payableAmount) { toast.error("Paid amount is less than payable"); return; }
    if (discountExceedsTotal) { toast.error("Discount exceeds total"); return; }
    if (discountAmount > 0 && (!discountName.trim() || !discountContact.trim())) {
      toast.error("Discount requires authoriser Name and Contact No");
      return;
    }

    // Open the print tab NOW, synchronously inside the click gesture, then
    // navigate it once the sale is saved. Opening it after the await would be
    // treated as a non-user-initiated popup and silently blocked by the browser
    // (the cause of "no invoice tab appears").
    const printWin = window.open("", "_blank");

    setSubmitting(true);
    try {
      // No connection → go straight to the offline queue (reuse the print tab).
      if (!isOnline) { await saveOfflineBill(printWin); return; }

      // Clean DTO: send only itemId + qty. Client-only lookup metadata
      // (name/uom/price/vatPercentage) is stripped to satisfy the backend's
      // whitelist + forbidNonWhitelisted ValidationPipe (avoids 400s).
      const sale = await posSalesApi.create({
        items: cart.map((c) => ({ itemId: c.itemId, qty: c.qty })),
        paidAmount: paid,
        servedBy: servedBy || undefined,
        salesType: payMode,
        bankId: payMode === "Card" ? (bankId || undefined) : undefined,
        branchId: user?.branchId || undefined,
        discountType: discVal > 0 ? discountType : undefined,
        discountValue: discVal > 0 ? discVal : undefined,
        discountRemarks: discountAmount > 0 ? discountName.trim() : undefined,
        discountContact: discountAmount > 0 ? discountContact.trim() : undefined,
      });
      toast.success(`Invoice ${sale.invoiceNo} generated!`);
      // Keep local caches in step with the server-side deduction.
      if (user) await deductCachedStock(user.id, cart.map((c) => ({ itemId: c.itemId, qty: c.qty })));
      decrementProductStock(cart);
      // Point the pre-opened tab at the print-ready receipt (auto-fires the
      // print dialog via ?print=1). Fall back to a fresh open if it was blocked.
      const url = `/pos/invoice/${sale.id}?print=1`;
      if (printWin) printWin.location.href = url;
      else window.open(url, "_blank");
      // …and reset the terminal for the next customer without a page reload.
      resetWorkspace();
    } catch (e: unknown) {
      // A network-level failure (no HTTP response) means we lost connectivity
      // mid-submit — fall back to the offline queue (reuse the same print tab).
      const hasResponse = !!(e as { response?: unknown }).response;
      if (!hasResponse) {
        try {
          await saveOfflineBill(printWin);
          return;
        } catch (offlineErr) {
          printWin?.close();
          toast.error(getErrorMessage(offlineErr, "Failed to save sale offline"));
          return;
        }
      }
      printWin?.close(); // nothing to show — don't leave a blank tab
      toast.error(getErrorMessage(e, "Failed to generate bill"));
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.itmCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader
        title="POS Billing"
        subtitle="Select items and generate invoice — products & prices managed via Items / Pricing"
      />

      {/* ─── Connection / offline-sync status bar ─────────────── */}
      <div className={`mb-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
        isOnline ? "border-sage-300 bg-white" : "border-amber-200 bg-amber-50"
      }`}>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
              <Wifi size={14} /> Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
              <WifiOff size={14} /> Offline — sales are saved locally
            </span>
          )}
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-gray-500">
              · <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{pendingCount}</span> pending sync
            </span>
          )}
        </div>
        {pendingCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => syncNow()}
            loading={syncing}
            disabled={!isOnline}
            title={isOnline ? "Upload offline sales now" : "Reconnect to sync"}
          >
            <RefreshCw size={13} />
            Sync now
          </Button>
        )}
      </div>

      {/* Stacks on narrow/short screens and only becomes a fixed-height split at
          lg. `min-w-0` on the product column is load-bearing: without it the
          product grid's min-content width can exceed the row and shove the cart
          off-screen entirely — which is why some terminals showed no cart. */}
      <div className="flex flex-col lg:flex-row gap-5 lg:h-[calc(100vh-14rem)]">
        {/* ─── Product Grid ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Pending order queue (Hold / Resume) — only shown when parked orders exist */}
          {queue.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                <PauseCircle size={13} />
                Pending Queue
                <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[10px]">
                  {queue.length}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {queue.map((h) => (
                  <div
                    key={h.id}
                    className="relative shrink-0 w-44 bg-amber-50 border border-amber-200 rounded-lg p-2.5 hover:border-amber-400 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => resumeOrder(h.id)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-center gap-1 text-[10px] text-amber-700">
                        <Clock size={10} />
                        {heldTimeLabel(h.heldAt)}
                        <span className="text-amber-500">· {heldOrderQty(h)} item(s)</span>
                      </div>
                      <div className="text-sm font-bold text-gray-800 mt-0.5">
                        ৳{fmt(heldOrderGross(h))}
                      </div>
                      {h.servedBy && (
                        <div className="text-[10px] text-gray-500 truncate">{h.servedBy}</div>
                      )}
                      <div className="text-[10px] text-primary-700 mt-1 font-medium">
                        Tap to resume →
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => discardHeld(h.id)}
                      title="Discard held order"
                      className="absolute top-1 right-1 text-amber-400 hover:text-red-500 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search by name or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-sage-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {canAddItem && (
              <Button
                variant="secondary"
                onClick={() => setItemModal(true)}
                disabled={!isOnline}
                title={isOnline ? "Add a new item to the catalogue" : "Reconnect to add an item"}
                className="shrink-0"
              >
                <PackagePlus size={15} />
                New Item
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Loading items…
            </div>
          ) : products.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
              <p className="text-sm">No items with an active price found.</p>
              <p className="text-xs text-gray-300">
                Add items via <strong>Inventory → Items</strong> and set prices via{" "}
                <strong>Pricing → Price Setup</strong>.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1">
              {/* Column counts step back down at lg because the cart now takes
                  half the row — keeps the product cards from being squeezed. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.stock <= 0}
                    title={p.stock <= 0 ? "Out of stock" : undefined}
                    className={`bg-white border border-sage-300 rounded-xl p-4 text-left transition-all group ${
                      p.stock <= 0
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-primary-500 hover:shadow-md active:scale-95"
                    }`}
                  >
                    <div className="w-full h-24 mb-2 rounded-lg overflow-hidden bg-sage-100 flex items-center justify-center">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.name}
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">🍬</span>
                      )}
                    </div>
                    <p className="font-medium text-sm text-gray-800 leading-tight line-clamp-2 group-hover:text-primary-700">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{p.itmCode}</p>
                    <p className="text-primary-700 font-bold text-sm mt-1.5">
                      ৳{fmt(Number(p.price))}
                      <span className="text-gray-400 font-normal text-[10px] ml-1">
                        /{p.uom}
                      </span>
                    </p>
                    <div className="flex items-center justify-between mt-0.5">
                      {Number(p.vatPercentage) > 0 ? (
                        <span className="text-[10px] text-orange-500">+{p.vatPercentage}% VAT</span>
                      ) : <span />}
                      <span
                        className={`text-[10px] font-medium ${
                          p.stock <= 0 ? "text-red-500" : "text-gray-400"
                        }`}
                      >
                        {p.stock <= 0 ? "Out of stock" : `Stock: ${fmtQty(p.stock)}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Cart + Payment ────────────────────────────────── */}
        <div className="w-full lg:w-1/2 flex flex-col gap-3 shrink-0 min-w-0">
          {/* Cart */}
          <div className="bg-white rounded-xl border border-sage-300 flex flex-col overflow-hidden flex-1 min-h-[16rem]">
            <div className="px-4 py-3 border-b border-sage-200 flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <ShoppingCart size={16} />
                Cart
                {cart.length > 0 && (
                  <span className="bg-primary-100 text-primary-700 text-xs rounded-full px-2 py-0.5">
                    {fmtQty(r2(cart.reduce((s, c) => s + c.qty, 0)))}
                  </span>
                )}
              </span>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-red-400 text-xs hover:text-red-600 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
                No items added yet
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {cart.map((c) => (
                  <div key={c.itemId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      <button
                        onClick={() => removeFromCart(c.itemId)}
                        className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <p className="text-xs text-gray-400 truncate">
                        ৳{fmt(c.price)} × {fmtQty(c.qty)} {c.uom}
                        {c.vatPercentage > 0 && (
                          <span className="text-orange-400 ml-1">+{c.vatPercentage}% VAT</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => changeQty(c.itemId, -1)}
                            className="w-6 h-6 rounded-md bg-sage-200 hover:bg-gray-200 flex items-center justify-center"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={MIN_QTY}
                            step={QTY_STEP}
                            value={qtyDraft[c.itemId] ?? fmtQty(c.qty)}
                            onChange={(e) =>
                              setQtyDraft((d) => ({ ...d, [c.itemId]: e.target.value }))
                            }
                            onBlur={(e) => commitQty(c.itemId, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            onFocus={(e) => e.currentTarget.select()}
                            aria-label={`Quantity for ${c.name}`}
                            className="w-14 text-center text-sm font-semibold border border-sage-300 rounded-md py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                          <button
                            onClick={() => changeQty(c.itemId, 1)}
                            className="w-6 h-6 rounded-md bg-sage-200 hover:bg-gray-200 flex items-center justify-center"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="text-sm font-bold text-primary-700 whitespace-nowrap">
                          ৳{fmt(itemSubtotal(c) + itemVat(c))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-xl border border-sage-300 p-4 space-y-3">
            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Sub-total</span>
                <span>৳{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>VAT</span>
                <span>৳{fmt(vatAmount)}</span>
              </div>

              {/* Discount row */}
              <div className="pt-2 pb-1">
                <div className="flex items-center gap-1 mb-1.5 text-xs font-medium text-gray-500">
                  <Tag size={11} />
                  Discount
                </div>
                <div className="flex gap-2">
                  {/* Type toggle */}
                  <div className="flex rounded-md border border-sage-300 overflow-hidden text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => { setDiscountType("fixed"); setDiscountValue(""); }}
                      className={`px-2.5 py-1.5 font-medium transition-colors ${
                        discountType === "fixed"
                          ? "bg-primary-700 text-white"
                          : "bg-white text-gray-500 hover:bg-sage-100"
                      }`}
                    >
                      ৳ Fixed
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDiscountType("percentage"); setDiscountValue(""); }}
                      className={`px-2.5 py-1.5 font-medium transition-colors border-l border-sage-300 ${
                        discountType === "percentage"
                          ? "bg-primary-700 text-white"
                          : "bg-white text-gray-500 hover:bg-sage-100"
                      }`}
                    >
                      % Off
                    </button>
                  </div>
                  {/* Value input */}
                  <input
                    type="number"
                    min="0"
                    max={discountType === "percentage" ? 100 : undefined}
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "percentage" ? "0–100" : "0.00"}
                    className={`flex-1 min-w-0 border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      discountExceedsTotal
                        ? "border-red-400 bg-red-50 focus:ring-red-400"
                        : "border-sage-300"
                    }`}
                  />
                </div>
                {discountExceedsTotal && (
                  <p className="text-xs text-red-500 mt-1">
                    {discountType === "percentage"
                      ? "Percentage cannot exceed 100%"
                      : "Discount cannot exceed total"}
                  </p>
                )}
                {discountAmount > 0 && !discountExceedsTotal && (
                  <p className="text-xs text-green-600 mt-1">
                    −৳{fmt(discountAmount)} applied
                  </p>
                )}

                {/* Discount authoriser — mandatory once a discount is applied. */}
                {discountAmount > 0 && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={discountName}
                      onChange={(e) => setDiscountName(e.target.value)}
                      placeholder="Guest name *"
                      className={`w-full border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${discountName.trim() ? "border-sage-300" : "border-red-300 bg-red-50"}`}
                    />
                    <input
                      type="text"
                      value={discountContact}
                      onChange={(e) => setDiscountContact(e.target.value)}
                      placeholder="Guest contact no *"
                      className={`w-full border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${discountContact.trim() ? "border-sage-300" : "border-red-300 bg-red-50"}`}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between font-bold text-gray-800 pt-1.5 border-t border-sage-200 text-base">
                <span>Payable</span>
                <span>৳{fmt(payableAmount)}</span>
              </div>
            </div>

            <Select
              label="Pay Mode"
              value={payMode}
              onChange={(e) => {
                const next = e.target.value;
                setPayMode(next);
                if (next !== "Card") setBankId("");
              }}
              options={POS_PAY_MODES.map((m) => ({ value: m, label: m }))}
            />

            {payMode === "Card" && (
              <Select
                label="Bank"
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                options={[
                  { value: "", label: "Select bank" },
                  ...banks.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            )}

            <Input
              label="Served By"
              value={servedBy}
              onChange={(e) => setServedBy(e.target.value)}
              placeholder="Staff name (optional)"
            />

            <Input
              label="Paid Amount (৳)"
              type="number"
              min="0"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="0.00"
            />

            {paid > 0 && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-500">Change</span>
                <span className={change < 0 ? "text-red-600" : "text-green-600"}>
                  ৳{fmt(Math.max(0, change))}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="shrink-0"
                size="lg"
                onClick={holdOrder}
                disabled={!cart.length}
                title="Park this order and clear the terminal"
              >
                <PauseCircle size={16} />
                Hold
              </Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={handleGenerateBill}
                loading={submitting}
                disabled={!cart.length || paid < payableAmount || discountExceedsTotal}
              >
                {isOnline ? "Generate Bill" : "Save Offline Bill"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* New item + its opening price, straight from the terminal. The catalogue
          is re-pulled on success so the card appears without a page reload. */}
      <ItemQuickAddModal
        open={itemModal}
        onClose={() => setItemModal(false)}
        onCreated={reloadProducts}
      />
    </AppLayout>
  );
}
