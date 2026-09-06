"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Image from "next/image";
import toast from "react-hot-toast";
import { posProductsApi, posSalesApi, posBanksApi, posCustomersApi, POS_PAY_MODES, MULTI_PAY_MODE, type PosProduct, type PosBank, type PosCustomer } from "@/lib/services/pos.service";
import PaymentSplitModal, { type SplitPayment, type SplitRow } from "@/components/pos/PaymentSplitModal";
import { adminService, type Branch } from "@/lib/services/admin.service";
import { useAuthStore } from "@/store/auth.store";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useLiveStock } from "@/hooks/useLiveStock";
import {
  addOfflineOrder, deductCachedStock, cacheStock, cacheCatalog, cacheCustomers,
  getCachedCatalog, getCachedCustomers, getCachedStock, getOfflineOrders, nextSequence,
  type OfflineOrder,
} from "@/lib/offline/offlineStore";
import { buildOfflineInvoiceNo, fallbackPrefix } from "@/lib/offline/invoice";
import { printOfflineReceipt } from "@/lib/offline/receipt";
import { getErrorMessage } from "@/lib/api";
import { roundPayable, formatDateTime } from "@/lib/utils";
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
  /** False for an item that is never discounted. Carried on the line so the
   *  running total matches what the server will charge — and so an offline
   *  sale, priced entirely here, applies the same rule. */
  isDiscountApplicable?: boolean;
}

type DiscountType = "fixed" | "percentage";

/** A parked order snapshot held in the local queue (Hold/Resume). */
interface HeldOrder {
  id: string;
  heldAt: string;
  cart: CartItem[];
  payMode: string;
  bankId: string;
  discountType: DiscountType;
  discountValue: string;
  /** Empty string is the walk-in customer — what a held order resumes to unless
   *  one was picked, exactly as a fresh terminal starts. */
  customerId: string;
  cardNo: string;
  /** The tender rows when the bill was held on Multiple. Absent on a
   *  single-payment hold, and on every order parked before splits existed. */
  splits?: SplitRow[];
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

  /** Who the bill is for. Defaults to the walk-in customer — the Customer row
   *  flagged `isWalkIn`, which is what the counter sells to most of the time, so
   *  it needs no action from the cashier and every sale still records a real
   *  customer. A DISCOUNT is the exception: it has to be given to somebody, and
   *  the walk-in is nobody, so a discounted bill won't go through until a named
   *  customer is picked (the server enforces the same rule).
   *
   *  Empty until the customer list lands — the picker fills it in below. */
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  /** Last 4 digits of the card, on a Card payment. Never more — the last four
   *  is all that may be kept, and all the settlement slip needs to match. */
  const [cardNo, setCardNo] = useState("");

  /** Split payment. `splitRows` is what the modal shows when reopened; `splits`
   *  is what gets posted. Both are empty unless the pay mode is Multiple, so the
   *  ordinary single-payment path carries nothing extra. */
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [splits, setSplits] = useState<SplitPayment[]>([]);

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

  // Customers for the picker, cached the same way the catalogue is: a till that
  // boots with no connection still has to be able to bill a named customer,
  // because that is the only way it can give a discount.
  useEffect(() => {
    let cancelled = false;
    // Select the counter customer as soon as the list is known, so a plain sale
    // is billed to it without the cashier touching the picker. Only ever fills a
    // BLANK picker: a resumed held order, or a customer the cashier already
    // chose, must not be reset by the list arriving late.
    const applyList = (list: PosCustomer[]) => {
      setCustomers(list);
      const walkIn = list.find((c) => c.isWalkIn);
      if (walkIn) setCustomerId((current) => current || walkIn.id);
    };
    posCustomersApi
      .getAll()
      .then(async (list) => {
        if (cancelled) return;
        applyList(list);
        if (user) await cacheCustomers(user.id, list);
      })
      .catch(async () => {
        if (!user) return;
        const cached = await getCachedCustomers(user.id);
        if (!cancelled) applyList(cached);
      });
    return () => { cancelled = true; };
  }, [user]);

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

  /** Take a freshly read set of on-hand levels and put it on screen.
   *
   *  Sales queued offline have not reached the server yet, so the levels come
   *  back without them — they are subtracted again here, or the grid would
   *  offer stock this terminal has already sold. The offline cache is written
   *  with the same net numbers it displays, since that is what a subsequent
   *  offline sale will be checked against. */
  const applyStockLevels = useCallback(async (levels: Record<string, number>) => {
    const queued: Record<string, number> = {};
    if (user) {
      const orders = await getOfflineOrders(user.id).catch(() => [] as OfflineOrder[]);
      for (const order of orders) {
        for (const line of order.items) queued[line.itemId] = (queued[line.itemId] ?? 0) + line.qty;
      }
    }
    // An item with no Inventory row is absent from the map, which is a zero
    // balance — the same thing the catalogue reports for it.
    const onHand = (itemId: string) => r2((levels[itemId] ?? 0) - (queued[itemId] ?? 0));

    setProducts((prev) => prev.map((p) => ({ ...p, stock: onHand(p.id) })));
    if (user) {
      await cacheStock(
        user.id,
        Object.keys(levels).map((itemId) => ({ itemId, quantity: onHand(itemId) })),
      ).catch(() => { /* storage unavailable — the screen is still correct */ });
    }
  }, [user]);

  /** Stock moves all day from places this terminal can't see — the next till
   *  along, a factory issue, a receive, an NC, an adjustment — and it is what
   *  the grid refuses lines on. So it is re-read on a timer, whenever the
   *  cashier comes back to the tab, and the moment anything in this browser
   *  books stock. An offline terminal sits on its cached counts instead. */
  useLiveStock(applyStockLevels, { enabled: isOnline });

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

  /** Tapping a card rings up one more of that item.
   *
   *  Stock sold by weight rarely lands on a whole number, so when less than a
   *  full unit is left the tap bills exactly that tail — the last 0.5 kg is real
   *  stock and has to be sellable. Only an empty balance is refused. */
  const addToCart = (product: PosProduct) => {
    const inCart = cart.find((c) => c.itemId === product.id)?.qty ?? 0;
    const remaining = r2(product.stock - inCart);
    if (remaining <= 0) {
      toast.error(`${product.name} — only ${fmtQty(product.stock)} in stock`);
      return;
    }
    const add = Math.min(1, remaining);
    if (add < 1) toast.success(`${product.name} — added the last ${fmtQty(add)}`);
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === product.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === product.id ? { ...c, qty: r2(c.qty + add) } : c
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
          qty: add,
          isDiscountApplicable: product.isDiscountApplicable !== false,
        },
      ];
    });
  };

  /** +/- stepper. Rounds to 2dp so 0.1 + 0.2 style drift can't creep in.
   *
   *  Raising past a partial tail lands on the tail rather than being refused, so
   *  "+" on a line holding 1 of an item with 1.5 on hand rings up the 0.5. */
  const changeQty = (itemId: string, delta: number) => {
    const line = cart.find((c) => c.itemId === itemId);
    if (!line) return;
    let next = r2(line.qty + delta);
    const onHand = stockOf(itemId);
    if (delta > 0 && next > onHand) {
      if (onHand <= line.qty) {
        toast.error(`${line.name} — only ${fmtQty(onHand)} in stock`);
        return;
      }
      next = r2(onHand);
    }
    setCart((prev) =>
      prev
        .map((c) => (c.itemId === itemId ? { ...c, qty: next } : c))
        .filter((c) => c.qty > 0)
    );
  };

  /**
   * What a typed qty is worth, in ONE place so the live (per-keystroke) path and
   * the commit (blur/Enter) path can never disagree — they differ only in
   * whether they complain.
   *
   * `null` means "not a number yet": a blank box or a half-typed "1." / "-".
   * That is a half-finished edit, not an instruction to drop the line.
   */
  const readQty = (itemId: string, raw: string): { value: number } | { error: string } | null => {
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return null;
    if (parsed <= 0) return null;
    const wanted = Math.max(MIN_QTY, r2(parsed));
    const onHand = stockOf(itemId);
    if (wanted > onHand) return { error: `Only ${fmtQty(onHand)} in stock` };
    return { value: wanted };
  };

  /**
   * Retype a qty. The line and the bill total follow the keystroke instead of
   * waiting for the box to lose focus — the cashier should see the money move as
   * they type.
   *
   * Anything not yet usable is just held in the draft: the line keeps its last
   * good qty and nothing is said. Complaining per keystroke would fire a toast
   * at "15" on the way to typing "1.5", and again at "1" on the way to "10" when
   * only 5 are on hand. The objection belongs at the end of the edit.
   */
  const typeQty = (itemId: string, raw: string) => {
    setQtyDraft((d) => ({ ...d, [itemId]: raw }));
    const read = readQty(itemId, raw);
    if (read && "value" in read) {
      setCart((prev) => prev.map((c) => (c.itemId === itemId ? { ...c, qty: read.value } : c)));
    }
  };

  /** Finish a typed qty. Blank/invalid/<=0 — or more than is on hand — reverts to
   *  the previous value rather than silently dropping the line or clamping to a
   *  number the cashier didn't type; removal is an explicit action. */
  const commitQty = (itemId: string, raw: string) => {
    setQtyDraft((d) => {
      const next = { ...d };
      delete next[itemId];
      return next;
    });
    const read = readQty(itemId, raw);
    if (!read) return;
    if ("error" in read) {
      toast.error(read.error);
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, qty: read.value } : c)),
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

  // The part of the bill a discount may be taken off. Items flagged not
  // discountable stand outside it entirely: a percentage is charged on this
  // figure, not on the gross, and a fixed amount is capped by it — so a 10%
  // discount on ৳1000 discountable plus ৳500 that is not comes to ৳100.
  // PosSalesService applies the identical rule, so the counter's figure and the
  // one the server stores are the same number.
  const discountableGross = r2(
    cart
      .filter((c) => c.isDiscountApplicable !== false)
      .reduce((s, c) => s + itemSubtotal(c) + itemVat(c), 0),
  );
  const hasNonDiscountable = cart.some((c) => c.isDiscountApplicable === false);

  const discVal = parseFloat(discountValue) || 0;
  const rawDiscount =
    discountType === "percentage"
      ? r2(discountableGross * discVal / 100)
      : r2(discVal);
  // Clamp: never exceed what may be discounted.
  const discountAmount = Math.min(rawDiscount, discountableGross);

  // Charged to the whole taka — the server rounds the figure it stores the same
  // way, so what is shown here, what is taken at the counter and what lands on
  // the bill are one number. `rounding` is the difference the summary shows so
  // the column still adds up on screen.
  const exactPayable = r2(grossAmount - discountAmount);
  const payableAmount = roundPayable(exactPayable);
  const rounding = r2(payableAmount - exactPayable);
  const paid = parseFloat(paidAmount) || 0;
  const change = r2(paid - payableAmount);

  /** The picked customer — the walk-in row unless the cashier chose someone. */
  const selectedCustomer = customers.find((c) => c.id === customerId);
  /** A discount has to be given to somebody. The walk-in customer is nobody, so
   *  the bill can't be discounted until a real one is named — the same rule the
   *  server applies, checked here so the cashier is told before they hit
   *  Generate. Tests the walk-in FLAG, not merely whether a customer is set:
   *  the till now always has one set. */
  const needsCustomerForDiscount =
    discountAmount > 0 && (!customerId || !!selectedCustomer?.isWalkIn);

  const isSplitMode = payMode === MULTI_PAY_MODE;
  const splitTotal = r2(splits.reduce((sum, t) => sum + t.amount, 0));
  /** The cart can change after a split was keyed, which would leave the tenders
   *  settling the wrong bill. Rather than silently rewriting what the cashier
   *  entered, the sale is blocked until they reopen and rebalance it. */
  const splitOutOfDate = isSplitMode && Math.abs(splitTotal - payableAmount) > 0.005;

  // Discount input validation hint
  const discountExceedsTotal =
    discountType === "fixed"
      ? discVal > discountableGross && discountableGross > 0
      : discVal > 100;

  // Clear the active billing terminal back to a blank, ready state.
  const resetWorkspace = () => {
    setCart([]);
    setPaidAmount("");
    setPayMode("Cash");
    setBankId("");
    setDiscountType("fixed");
    setDiscountValue("");
    // Back to the counter customer, not to blank: the till starts every sale on
    // the walk-in row, and the load effect only fills an empty picker on mount.
    setCustomerId(customers.find((c) => c.isWalkIn)?.id ?? "");
    setCardNo("");
    setSplits([]);
    setSplitRows([]);
  };

  // ── Hold / Resume ────────────────────────────────────────────
  const holdOrder = () => {
    if (!cart.length) { toast.error("Nothing to hold"); return; }
    const held: HeldOrder = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      heldAt: new Date().toISOString(),
      cart,
      payMode,
      bankId,
      discountType,
      discountValue,
      customerId,
      cardNo,
      splits: splitRows.length ? splitRows : undefined,
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
          payMode,
          bankId,
          discountType,
          discountValue,
          customerId,
          cardNo,
        });
      }
      return remaining;
    });
    setCart(held.cart);
    setPayMode(held.payMode ?? "Cash");
    setBankId(held.bankId ?? "");
    setDiscountType(held.discountType);
    setDiscountValue(held.discountValue);
    // An order parked before the picker existed has no customer — it resumes on
    // the walk-in customer, the same place a fresh sale starts.
    setCustomerId(held.customerId || customers.find((c) => c.isWalkIn)?.id || "");
    setCardNo(held.cardNo ?? "");
    const heldSplits = held.splits ?? [];
    setSplitRows(heldSplits);
    setSplits(
      heldSplits.map((r) => ({
        method: r.method,
        amount: parseFloat(r.amount) || 0,
        bankId: r.method === "Card" && r.bankId ? r.bankId : undefined,
        cardNo: r.method === "Card" && r.cardNo ? r.cardNo : undefined,
        transactionRef: r.transactionRef || undefined,
      })).filter((t) => t.amount > 0),
    );
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
      salesType: payMode,
      bankId: payMode === "Card" ? (bankId || undefined) : undefined,
      branchId: user.branchId || undefined,
      discountType: discVal > 0 ? discountType : undefined,
      discountValue: discVal > 0 ? discVal : undefined,
      customerId: customerId || undefined,
      cardNo: payMode === "Card" ? (cardNo.trim() || undefined) : undefined,
      // A bill split at the till while offline syncs as a split, rather than
      // collapsing to whichever single mode happened to be selected.
      payments: isSplitMode && splits.length ? splits : undefined,
      display: {
        // DD-MMM-YYYY h:mm AM, never the terminal's own locale format.
        dateTime: formatDateTime(at),
        // Whoever is signed in served the sale — the same name the server will
        // stamp on it when this order syncs.
        servedBy: user.name || user.userName,
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
    // A split settles the bill through its own rows, so the Paid box is not the
    // measure — buildPayments checks the tenders against the payable instead.
    if (!isSplitMode && paid < payableAmount) { toast.error("Paid amount is less than payable"); return; }
    if (discountExceedsTotal) { toast.error("Discount exceeds total"); return; }
    if (needsCustomerForDiscount) {
      toast.error("Select a customer — a discount cannot be given to a walk-in");
      return;
    }
    if (payMode === "Card" && cardNo.trim() && cardNo.trim().length !== 4) {
      toast.error("Card No must be the last 4 digits");
      return;
    }
    if (isSplitMode && !splits.length) {
      toast.error("Add the payment splits before generating the bill");
      setSplitOpen(true);
      return;
    }
    if (splitOutOfDate) {
      toast.error(`Splits total ৳${fmt(splitTotal)} but the bill is ৳${fmt(payableAmount)} — rebalance them`);
      setSplitOpen(true);
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
        salesType: payMode,
        bankId: payMode === "Card" ? (bankId || undefined) : undefined,
        branchId: user?.branchId || undefined,
        discountType: discVal > 0 ? discountType : undefined,
        discountValue: discVal > 0 ? discVal : undefined,
        customerId: customerId || undefined,
        cardNo: payMode === "Card" ? (cardNo.trim() || undefined) : undefined,
        payments: isSplitMode && splits.length ? splits : undefined,
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
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {c.name}
                        {/* Called out on the line itself: a customer asking why
                            the discount looks short is pointing at this row. */}
                        {c.isDiscountApplicable === false && (
                          <span
                            title="No discount applies to this item"
                            className="ml-1.5 align-middle text-[10px] font-medium text-amber-700 bg-amber-50 rounded px-1.5 py-0.5"
                          >
                            NO DISC
                          </span>
                        )}
                      </p>
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
                            onChange={(e) => typeQty(c.itemId, e.target.value)}
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
                      : hasNonDiscountable
                        ? `Discount cannot exceed the discountable total (৳${fmt(discountableGross)})`
                        : "Discount cannot exceed total"}
                  </p>
                )}
                {discountAmount > 0 && !discountExceedsTotal && (
                  <p className="text-xs text-green-600 mt-1">
                    −৳{fmt(discountAmount)} applied
                  </p>
                )}
                {/* Says why the figure is smaller than the bill would suggest,
                    at the moment the cashier is looking at the discount. */}
                {hasNonDiscountable && (
                  <p className="text-xs text-amber-600 mt-1">
                    Charged on ৳{fmt(discountableGross)} — this bill has items that are not discountable.
                  </p>
                )}

                {/* A discount has to be given to somebody. The name and phone
                    number that used to be typed here are now the picked
                    customer's, taken from their record — so this says what is
                    missing and points at the field that fixes it. */}
                {needsCustomerForDiscount && (
                  <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
                    Select a customer below — a discount cannot be given to a walk-in.
                  </p>
                )}
              </div>

              {rounding !== 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Rounding</span>
                  <span>{rounding > 0 ? "+" : "−"}৳{fmt(Math.abs(rounding))}</span>
                </div>
              )}

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
                // Leaving Card drops both of the card's fields — a cash bill
                // must not keep a bank or a card number from a mode it is no
                // longer in.
                if (next !== "Card") { setBankId(""); setCardNo(""); }
                if (next === MULTI_PAY_MODE) {
                  // Picking Multiple IS the request to split, so open the modal
                  // rather than making the cashier hunt for a second control.
                  setSplitOpen(true);
                } else {
                  setSplits([]);
                  setSplitRows([]);
                }
              }}
              options={[
                ...POS_PAY_MODES.map((m) => ({ value: m, label: m })),
                { value: MULTI_PAY_MODE, label: `${MULTI_PAY_MODE} (split payment)` },
              ]}
            />

            {isSplitMode && (
              <div className={`rounded-md border px-3 py-2 text-sm ${splitOutOfDate ? "border-amber-400 bg-amber-50" : "border-sage-300 bg-white"}`}>
                {splits.length ? (
                  <>
                    <ul className="space-y-0.5">
                      {splits.map((t, i) => (
                        <li key={i} className="flex justify-between">
                          <span className="text-gray-600">
                            {t.method}
                            {t.transactionRef ? ` · ${t.transactionRef}` : ""}
                          </span>
                          <span className="font-medium text-gray-900">৳{fmt(t.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    {splitOutOfDate && (
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        Splits total ৳{fmt(splitTotal)} but the bill is now ৳{fmt(payableAmount)} — rebalance.
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500">No splits entered yet.</span>
                )}
                <button
                  type="button"
                  onClick={() => setSplitOpen(true)}
                  className="mt-1 text-sm font-medium text-primary-700 hover:text-primary-900"
                >
                  {splits.length ? "Edit split" : "Add Payment Split"}
                </button>
              </div>
            )}

            {payMode === "Card" && (
              <>
                <Select
                  label="Bank"
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                  options={[
                    { value: "", label: "Select bank" },
                    ...banks.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                />
                {/* Last four only — it is all that may be kept, and all the
                    end-of-day settlement slip needs to match a bill to a card. */}
                <Input
                  label="Card No (last 4 digits)"
                  inputMode="numeric"
                  maxLength={4}
                  value={cardNo}
                  onChange={(e) => setCardNo(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                />
              </>
            )}

            {/* Who the bill is for. The counter customer is preselected and
                covers most of the counter's trade; picking a real customer names
                the sale on the reports, and is required before it can be
                discounted. Every option is a row from the Customer table — the
                walk-in is one of them, so there is no synthetic blank entry. */}
            <Select
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              searchable
              options={customers.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
              error={needsCustomerForDiscount ? "A discounted sale needs a customer" : undefined}
            />

            {selectedCustomer && (
              <div className="rounded-md border border-sage-300 bg-sage-50 px-3 py-2 text-xs space-y-0.5">
                <p className="text-gray-500">
                  Name: <span className="font-medium text-gray-800">{selectedCustomer.name}</span>
                </p>
                <p className="text-gray-500">
                  Contact No:{" "}
                  <span className="font-medium text-gray-800">
                    {selectedCustomer.mobile || "— not on file —"}
                  </span>
                </p>
              </div>
            )}

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
                disabled={!cart.length || paid < payableAmount || discountExceedsTotal || needsCustomerForDiscount}
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

      {/* Splits one bill across several tenders. Cancelling without a balanced
          split leaves the pay mode on Multiple with nothing entered, which the
          Generate guard catches — the cashier is never left thinking a bill is
          settled when it is not. */}
      <PaymentSplitModal
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        payable={payableAmount}
        banks={banks}
        initial={splitRows}
        onConfirm={(payments) => {
          setSplits(payments);
          setSplitRows(
            payments.map((t) => ({
              method: t.method,
              amount: String(t.amount),
              bankId: t.bankId ?? "",
              cardNo: t.cardNo ?? "",
              transactionRef: t.transactionRef ?? "",
            })),
          );
          setSplitOpen(false);
        }}
      />
    </AppLayout>
  );
}
