"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Image from "next/image";
import toast from "react-hot-toast";
import { posProductsApi, posSalesApi, posBanksApi, posCustomersApi, POS_PAY_MODES, MULTI_PAY_MODE, type PosProduct, type PosBank, type PosCustomer } from "@/lib/services/pos.service";
import PaymentSplitModal, { type SplitPayment, type SplitRow } from "@/components/pos/PaymentSplitModal";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import { roundPayable } from "@/lib/utils";
import { ShoppingCart, Plus, Minus, Trash2, Search, Tag, ArrowLeft } from "lucide-react";

interface CartItem {
  itemId: string;
  name: string;
  uom: string;
  price: number;
  vatPercentage: number;
  qty: number;
  /** False for an item that is never discounted — billed in full, and its value
   *  left out of the base the discount is charged on. */
  isDiscountApplicable?: boolean;
}

type DiscountType = "fixed" | "percentage";

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toFixed(2);
/** Qty is decimal (2dp) for weight-priced items — show whole numbers cleanly. */
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const QTY_STEP = 0.01;
const MIN_QTY = 0.01;

export default function PosSaleEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = usePermissions();
  const canEdit = can("POSSales", "edit");

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  /** What is being typed in a line's qty box, keyed by item. Held apart from the
   *  cart so a half-typed "1." is not parsed into the line on every keystroke. */
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [invoiceNo, setInvoiceNo] = useState("");
  const [salesType, setSalesType] = useState("Cash");
  const [banks, setBanks] = useState<PosBank[]>([]);
  const [bankId, setBankId] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  /** Read-only: who served the sale is stamped from the session at the till and
   *  an edit never reassigns it, so this is shown but not editable. */
  const [servedBy, setServedBy] = useState("");
  const [search, setSearch] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("fixed");
  const [discountValue, setDiscountValue] = useState("");
  /** Who the sale was billed to — prefilled from the sale, so an edit that does
   *  not touch it does not turn a named customer back into a walk-in. Empty is
   *  the walk-in case, which a discounted sale is not allowed to be. */
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  /** Last 4 digits of the card, on a Card sale. */
  const [cardNo, setCardNo] = useState("");

  /** The tender rows of a split bill. Loaded from the sale being edited, so
   *  saving an untouched split re-writes the same breakdown rather than
   *  collapsing it to one tender called "Multiple". */
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [splits, setSplits] = useState<SplitPayment[]>([]);
  // Mandatory on every update — audited in the Daily Final Report.
  const [modifyReason, setModifyReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Load the products and the existing sale together, then prefill the cart.
  // Line price/UOM come from the live catalog when the item is still priced,
  // falling back to the stored line values otherwise (so the row still shows).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [prods, sale] = await Promise.all([posProductsApi.getAll(), posSalesApi.getOne(id)]);
        if (cancelled) return;
        setProducts(prods);
        setInvoiceNo(sale.invoiceNo);
        setSalesType(sale.salesType || "Cash");
        setBankId(sale.bankId || "");
        setServedBy(sale.servedBy || "");
        setPaidAmount(String(sale.paidAmount ?? ""));
        // Unconditional: the customer is on the sale whether or not it was
        // discounted, and the update writes whatever the picker holds — so a
        // non-discounted sale would be demoted to a walk-in by an unrelated
        // edit if this only ran inside the branch below.
        setCustomerId(sale.customerId ?? "");
        setCardNo(sale.cardNo ?? "");
        // Only a genuine split is loaded as one: a single-tender sale keeps the
        // ordinary Pay Mode panel, exactly as it did before splits existed.
        const tenders = sale.payments ?? [];
        if (tenders.length > 1) {
          setSplits(
            tenders.map((t) => ({
              method: t.method,
              amount: Number(t.amount),
              bankId: t.bankId ?? undefined,
              cardNo: t.cardNo ?? undefined,
              transactionRef: t.transactionRef ?? undefined,
            })),
          );
          setSplitRows(
            tenders.map((t) => ({
              method: t.method,
              amount: String(Number(t.amount)),
              bankId: t.bankId ?? "",
              cardNo: t.cardNo ?? "",
              transactionRef: t.transactionRef ?? "",
            })),
          );
        }
        if (Number(sale.discountAmount) > 0) {
          setDiscountType("fixed");
          setDiscountValue(String(sale.discountAmount));
        }
        const byId = new Map(prods.map((p) => [p.id, p]));
        setCart(
          sale.items.map((it) => {
            const p = byId.get(it.itemId);
            return {
              itemId: it.itemId,
              name: it.productName,
              uom: p?.uom ?? "",
              price: Number(p?.price ?? it.rate),
              vatPercentage: Number(p?.vatPercentage ?? it.vatPct),
              qty: Number(it.qty),
              isDiscountApplicable: p?.isDiscountApplicable !== false,
            };
          }),
        );
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // Banks for the Card-payment dropdown (best-effort).
  useEffect(() => {
    posBanksApi.getAll().then(setBanks).catch(() => {});
  }, []);

  // Customers for the picker. Best-effort: this screen is online-only, and a
  // failed load leaves the sale's own customer selected but unnamed rather than
  // silently reassigning it.
  useEffect(() => {
    posCustomersApi.getAll().then((list) => {
      setCustomers(list);
      // A sale raised before the walk-in customer existed carries no customer at
      // all. With no blank option in the picker that would render as an empty
      // box, so it lands on the counter customer instead — which is what saving
      // it would record anyway (the server fills an absent customer with the
      // walk-in row). Only ever fills a BLANK picker, never overrides the
      // customer the sale was actually billed to.
      const walkIn = list.find((c) => c.isWalkIn);
      if (walkIn) setCustomerId((current) => current || walkIn.id);
    }).catch(() => {});
  }, []);

  const addToCart = (product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === product.id);
      if (existing) return prev.map((c) => (c.itemId === product.id ? { ...c, qty: r2(c.qty + 1) } : c));
      return [
        ...prev,
        {
          itemId: product.id,
          name: product.name,
          uom: product.uom,
          price: Number(product.price),
          vatPercentage: Number(product.vatPercentage),
          qty: 1,
          isDiscountApplicable: product.isDiscountApplicable !== false,
        },
      ];
    });
  };

  /** +/- stepper. Rounds to 2dp so stepping a fractional line (11.60 - 1) cannot
   *  leave float drift behind. */
  const changeQty = (itemId: string, delta: number) =>
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, qty: r2(c.qty + delta) } : c)).filter((c) => c.qty > 0),
    );

  /** What a typed qty is worth, in one place so the live and the commit path
   *  can't disagree. `null` is "not usable yet" — blank, half-typed, or <= 0.
   *
   *  No on-hand clamp here, unlike the terminal: this sale's own quantities are
   *  already deducted from stock, so the ceiling is "on hand plus what this line
   *  currently holds". The server works that out for real when it re-prices
   *  (assertStockAvailable credits the existing lines back); guessing at it here
   *  would block legitimate edits. */
  const readQty = (raw: string): number | null => {
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.max(MIN_QTY, r2(parsed));
  };

  const setQty = (itemId: string, qty: number) =>
    setCart((prev) => prev.map((c) => (c.itemId === itemId ? { ...c, qty } : c)));

  /** Retype a qty. The line and the invoice totals follow the keystroke rather
   *  than waiting for the box to lose focus; a half-typed value is just held in
   *  the draft, leaving the line on its last good qty. */
  const typeQty = (itemId: string, raw: string) => {
    setQtyDraft((d) => ({ ...d, [itemId]: raw }));
    const qty = readQty(raw);
    if (qty !== null) setQty(itemId, qty);
  };

  /** Finish a typed qty. Blank or <= 0 reverts to the previous value rather than
   *  silently dropping the line — removal is the trash button, an explicit act. */
  const commitQty = (itemId: string, raw: string) => {
    setQtyDraft((d) => {
      const next = { ...d };
      delete next[itemId];
      return next;
    });
    const qty = readQty(raw);
    if (qty !== null) setQty(itemId, qty);
  };

  const removeFromCart = (itemId: string) => setCart((prev) => prev.filter((c) => c.itemId !== itemId));

  const itemSubtotal = (c: CartItem) => c.price * c.qty;
  const itemVat = (c: CartItem) => Math.round(c.price * c.qty * c.vatPercentage) / 100;

  const subtotal = r2(cart.reduce((s, c) => s + itemSubtotal(c), 0));
  const vatAmount = r2(cart.reduce((s, c) => s + itemVat(c), 0));
  const grossAmount = r2(subtotal + vatAmount);

  // Same exclusion the till and the server apply: items flagged not
  // discountable are outside the discount, so a percentage is charged on the
  // rest of the bill and a fixed amount is capped by it.
  const discountableGross = r2(
    cart
      .filter((c) => c.isDiscountApplicable !== false)
      .reduce((s, c) => s + itemSubtotal(c) + itemVat(c), 0),
  );
  const hasNonDiscountable = cart.some((c) => c.isDiscountApplicable === false);
  const discVal = parseFloat(discountValue) || 0;
  const rawDiscount = discountType === "percentage" ? r2((discountableGross * discVal) / 100) : r2(discVal);
  const discountAmount = Math.min(rawDiscount, discountableGross);
  // Rounded to the whole taka, exactly as the new-sale screen and the server do
  // — an edit must not re-price the bill just by being reopened.
  const exactPayable = r2(grossAmount - discountAmount);
  const payableAmount = roundPayable(exactPayable);
  const rounding = r2(payableAmount - exactPayable);
  const paid = parseFloat(paidAmount) || 0;
  const change = r2(paid - payableAmount);

  const discountExceedsTotal =
    discountType === "fixed" ? discVal > discountableGross && discountableGross > 0 : discVal > 100;

  const selectedCustomer = customers.find((c) => c.id === customerId);
  /** Same rule as the till: a discount has to be given to somebody, so an edit
   *  that leaves one applied has to name the customer it went to — and the
   *  walk-in customer is nobody, which is why this tests the flag rather than
   *  just whether a customer is set. */
  const needsCustomerForDiscount =
    discountAmount > 0 && (!customerId || !!selectedCustomer?.isWalkIn);

  const isSplitMode = salesType === MULTI_PAY_MODE;
  const splitTotal = Math.round(splits.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  /** Editing the cart moves the bill, which leaves the tenders settling the
   *  wrong amount — blocked until they are rebalanced, never silently rewritten. */
  const splitOutOfDate = isSplitMode && Math.abs(splitTotal - payableAmount) > 0.005;

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.itmCode.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );

  const handleSave = async () => {
    if (!cart.length) { toast.error("Cart is empty"); return; }
    if (discountExceedsTotal) { toast.error("Discount exceeds total"); return; }
    // A split settles the bill through its own rows, so the Paid box is not the
    // measure — buildPayments checks the tenders against the payable instead.
    if (!isSplitMode && paid < payableAmount) { toast.error("Paid amount is less than payable"); return; }
    if (!modifyReason.trim()) { toast.error("Modify Reason is required"); return; }
    if (needsCustomerForDiscount) {
      toast.error("Select a customer — a discount cannot be given to a walk-in");
      return;
    }
    if (isSplitMode && !splits.length) {
      toast.error("Add the payment splits before saving");
      setSplitOpen(true);
      return;
    }
    if (splitOutOfDate) {
      toast.error(`Splits total ৳${splitTotal.toFixed(2)} but the bill is ৳${payableAmount.toFixed(2)} — rebalance them`);
      setSplitOpen(true);
      return;
    }
    if (salesType === "Card" && cardNo.trim() && cardNo.trim().length !== 4) {
      toast.error("Card No must be the last 4 digits");
      return;
    }

    setSubmitting(true);
    try {
      await posSalesApi.update(id, {
        items: cart.map((c) => ({ itemId: c.itemId, qty: c.qty })),
        paidAmount: paid,
        salesType: salesType || undefined,
        bankId: salesType === "Card" ? (bankId || undefined) : undefined,
        discountType: discVal > 0 ? discountType : undefined,
        discountValue: discVal > 0 ? discVal : undefined,
        customerId: customerId || undefined,
        cardNo: salesType === "Card" ? (cardNo.trim() || undefined) : undefined,
        payments: isSplitMode && splits.length ? splits : undefined,
        modifyRemarks: modifyReason.trim(),
      });
      toast.success(`Invoice ${invoiceNo} updated`);
      router.push("/pos/sales");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to update sale"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canEdit) {
    return (
      <AppLayout>
        <PageHeader title="Edit POS Sale" />
        <div className="text-center py-16 text-gray-400 text-sm">You don’t have permission to edit POS sales.</div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Edit POS Sale" />
        <div className="text-center py-16 text-gray-400 text-sm">Loading sale…</div>
      </AppLayout>
    );
  }

  if (notFound) {
    return (
      <AppLayout>
        <PageHeader title="Edit POS Sale" />
        <div className="text-center py-16 text-gray-400 text-sm">
          <p className="mb-3">Sale not found.</p>
          <Button variant="secondary" onClick={() => router.push("/pos/sales")}>Back to POS Sales</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title={`Edit Sale — ${invoiceNo}`} subtitle="Update items & payment, then save to re-price and adjust stock" />

      <button
        onClick={() => router.push("/pos/sales")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft size={15} /> Back to POS Sales
      </button>

      <div className="flex flex-col lg:flex-row gap-5 lg:h-[calc(100vh-16rem)]">
        {/* ─── Product Grid ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="mb-3 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-sage-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="bg-white border border-sage-300 rounded-xl p-3 text-left hover:border-primary-500 hover:shadow-md transition-all active:scale-95"
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
                  <p className="font-medium text-sm text-gray-800 leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{p.itmCode}</p>
                  <p className="text-primary-700 font-bold text-sm mt-1.5">
                    ৳{fmt(Number(p.price))}
                    <span className="text-gray-400 font-normal text-[10px] ml-1">/{p.uom}</span>
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Cart + Payment ────────────────────────────────── */}
        {/* The column scrolls as a whole and the cart carries a min-height: it
            is `overflow-hidden`, which zeroes a flex item's automatic minimum
            size, so without a floor a payment card taller than the column
            silently collapses the cart to nothing rather than pushing it. */}
        <div className="w-full lg:w-[28rem] flex flex-col gap-3 shrink-0 overflow-y-auto">
          <div className="bg-white rounded-xl border border-sage-300 flex flex-col overflow-hidden flex-1 min-h-[16rem]">
            {/* Same cart as the terminal: total qty in the badge, Clear all, and
                a typed quantity box per line so weight-priced items can be
                edited to a fraction instead of only stepped by whole units. */}
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
                              typeQty(c.itemId, e.target.value)
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

          <div className="bg-white rounded-xl border border-sage-300 p-4 space-y-3 shrink-0">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500"><span>Sub-total</span><span>৳{fmt(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>VAT</span><span>৳{fmt(vatAmount)}</span></div>

              <div className="pt-2 pb-1">
                <div className="flex items-center gap-1 mb-1.5 text-xs font-medium text-gray-500"><Tag size={11} /> Discount</div>
                <div className="flex gap-2">
                  <div className="flex rounded-md border border-sage-300 overflow-hidden text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => { setDiscountType("fixed"); setDiscountValue(""); }}
                      className={`px-2.5 py-1.5 font-medium transition-colors ${discountType === "fixed" ? "bg-primary-700 text-white" : "bg-white text-gray-500 hover:bg-sage-100"}`}
                    >
                      ৳ Fixed
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDiscountType("percentage"); setDiscountValue(""); }}
                      className={`px-2.5 py-1.5 font-medium transition-colors border-l border-sage-300 ${discountType === "percentage" ? "bg-primary-700 text-white" : "bg-white text-gray-500 hover:bg-sage-100"}`}
                    >
                      % Off
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={discountType === "percentage" ? 100 : undefined}
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "percentage" ? "0–100" : "0.00"}
                    className={`flex-1 min-w-0 border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${discountExceedsTotal ? "border-red-400 bg-red-50 focus:ring-red-400" : "border-sage-300"}`}
                  />
                </div>
                {discountExceedsTotal && (
                  <p className="text-xs text-red-500 mt-1">
                    {discountType === "percentage" ? "Percentage cannot exceed 100%" : "Discount cannot exceed total"}
                  </p>
                )}
                {discountAmount > 0 && !discountExceedsTotal && (
                  <p className="text-xs text-green-600 mt-1">−৳{fmt(discountAmount)} applied</p>
                )}
                {hasNonDiscountable && (
                  <p className="text-xs text-amber-600 mt-1">
                    Charged on ৳{fmt(discountableGross)} — this bill has items that are not discountable.
                  </p>
                )}

                {/* The discount's name and contact number are the picked
                    customer's, read off their record — so this says what is
                    missing rather than asking for it to be typed again. */}
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
                <span>Payable</span><span>৳{fmt(payableAmount)}</span>
              </div>
            </div>

            <Select
              label="Pay Mode"
              value={salesType}
              onChange={(e) => {
                const next = e.target.value;
                setSalesType(next);
                // Leaving Card drops both of the card's fields — a cash bill
                // must not keep a bank or a card number from a mode it is no
                // longer in.
                if (next !== "Card") { setBankId(""); setCardNo(""); }
                if (next === MULTI_PAY_MODE) setSplitOpen(true);
                else { setSplits([]); setSplitRows([]); }
              }}
              options={[
                ...((POS_PAY_MODES as readonly string[]).includes(salesType) || salesType === MULTI_PAY_MODE
                  ? [...POS_PAY_MODES]
                  : [salesType, ...POS_PAY_MODES]
                )
                  .filter(Boolean)
                  .map((m) => ({ value: m, label: m })),
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
                          <span className="text-gray-600">{t.method}</span>
                          <span className="font-medium text-gray-900">৳{t.amount.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                    {splitOutOfDate && (
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        Splits total ৳{splitTotal.toFixed(2)} but the bill is now ৳{payableAmount.toFixed(2)} — rebalance.
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

            {salesType === "Card" && (
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

            {/* Every option is a Customer row — the walk-in included — so there
                is no synthetic blank entry. */}
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

            {/* The cashier who rang the sale, stamped from their session at the
                till. An edit corrects the sale, never who served it. */}
            <Input label="Served By" value={servedBy} disabled readOnly />
            <Input
              label="Modify Reason *"
              value={modifyReason}
              onChange={(e) => setModifyReason(e.target.value)}
              placeholder="Why is this sale being changed?"
              className={modifyReason.trim() ? undefined : "border-red-300 bg-red-50"}
            />
            <Input label="Paid Amount (৳)" type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0.00" />

            {paid > 0 && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-500">Change</span>
                <span className={change < 0 ? "text-red-600" : "text-green-600"}>৳{fmt(Math.max(0, change))}</span>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleSave}
              loading={submitting}
              disabled={
                !cart.length ||
                (!isSplitMode && paid < payableAmount) ||
                (isSplitMode && (!splits.length || splitOutOfDate)) ||
                discountExceedsTotal ||
                !modifyReason.trim() ||
                needsCustomerForDiscount
              }
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>

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
