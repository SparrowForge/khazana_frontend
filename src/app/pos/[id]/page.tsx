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
import { posProductsApi, posSalesApi, posBanksApi, POS_PAY_MODES, type PosProduct, type PosBank } from "@/lib/services/pos.service";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import { ShoppingCart, Plus, Minus, Trash2, Search, Tag, ArrowLeft } from "lucide-react";

interface CartItem {
  itemId: string;
  name: string;
  uom: string;
  price: number;
  vatPercentage: number;
  qty: number;
}

type DiscountType = "fixed" | "percentage";

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toFixed(2);

export default function PosSaleEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = usePermissions();
  const canEdit = can("POSSales", "edit");

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [salesType, setSalesType] = useState("Cash");
  const [banks, setBanks] = useState<PosBank[]>([]);
  const [bankId, setBankId] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [servedBy, setServedBy] = useState("");
  const [search, setSearch] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [discountName, setDiscountName] = useState("");
  const [discountContact, setDiscountContact] = useState("");
  /** Walk-in customer's name — prefilled from the sale so an edit that does not
   *  touch it does not wipe it. */
  const [guestName, setGuestName] = useState("");
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
        if (Number(sale.discountAmount) > 0) {
          setDiscountType("fixed");
          setDiscountValue(String(sale.discountAmount));
          setDiscountName(sale.discountRemarks ?? "");
          setDiscountContact(sale.discountContact ?? "");
          setGuestName(sale.guestName ?? "");
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

  const addToCart = (product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === product.id);
      if (existing) return prev.map((c) => (c.itemId === product.id ? { ...c, qty: c.qty + 1 } : c));
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

  const changeQty = (itemId: string, delta: number) =>
    setCart((prev) => prev.map((c) => (c.itemId === itemId ? { ...c, qty: c.qty + delta } : c)).filter((c) => c.qty > 0));

  const removeFromCart = (itemId: string) => setCart((prev) => prev.filter((c) => c.itemId !== itemId));

  const itemSubtotal = (c: CartItem) => c.price * c.qty;
  const itemVat = (c: CartItem) => Math.round(c.price * c.qty * c.vatPercentage) / 100;

  const subtotal = r2(cart.reduce((s, c) => s + itemSubtotal(c), 0));
  const vatAmount = r2(cart.reduce((s, c) => s + itemVat(c), 0));
  const grossAmount = r2(subtotal + vatAmount);

  const discVal = parseFloat(discountValue) || 0;
  const rawDiscount = discountType === "percentage" ? r2((grossAmount * discVal) / 100) : r2(discVal);
  const discountAmount = Math.min(rawDiscount, grossAmount);
  const payableAmount = r2(grossAmount - discountAmount);
  const paid = parseFloat(paidAmount) || 0;
  const change = r2(paid - payableAmount);

  const discountExceedsTotal =
    discountType === "fixed" ? discVal > grossAmount && grossAmount > 0 : discVal > 100;

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
    if (paid < payableAmount) { toast.error("Paid amount is less than payable"); return; }
    if (!modifyReason.trim()) { toast.error("Modify Reason is required"); return; }
    if (discountAmount > 0 && (!discountName.trim() || !discountContact.trim())) {
      toast.error("Discount requires authoriser Name and Contact No");
      return;
    }

    setSubmitting(true);
    try {
      await posSalesApi.update(id, {
        items: cart.map((c) => ({ itemId: c.itemId, qty: c.qty })),
        paidAmount: paid,
        servedBy: servedBy || undefined,
        salesType: salesType || undefined,
        bankId: salesType === "Card" ? (bankId || undefined) : undefined,
        discountType: discVal > 0 ? discountType : undefined,
        discountValue: discVal > 0 ? discVal : undefined,
        discountRemarks: discountAmount > 0 ? discountName.trim() : undefined,
        discountContact: discountAmount > 0 ? discountContact.trim() : undefined,
        guestName: guestName.trim() || undefined,
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

      <div className="flex gap-5 h-[calc(100vh-16rem)]">
        {/* ─── Product Grid ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
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
        <div className="w-80 flex flex-col gap-3 shrink-0">
          <div className="bg-white rounded-xl border border-sage-300 flex flex-col overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-sage-200 flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <ShoppingCart size={16} /> Cart
                {cart.length > 0 && (
                  <span className="bg-primary-100 text-primary-700 text-xs rounded-full px-2 py-0.5">
                    {cart.reduce((s, c) => s + c.qty, 0)}
                  </span>
                )}
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">No items</div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {cart.map((c) => (
                  <div key={c.itemId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">
                          ৳{fmt(c.price)} × {c.qty} {c.uom}
                          {c.vatPercentage > 0 && <span className="text-orange-400 ml-1">+{c.vatPercentage}% VAT</span>}
                        </p>
                      </div>
                      <button onClick={() => removeFromCart(c.itemId)} className="text-gray-300 hover:text-red-500 transition-colors mt-0.5">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(c.itemId, -1)} className="w-6 h-6 rounded-md bg-sage-200 hover:bg-gray-200 flex items-center justify-center">
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{c.qty}</span>
                        <button onClick={() => changeQty(c.itemId, 1)} className="w-6 h-6 rounded-md bg-sage-200 hover:bg-gray-200 flex items-center justify-center">
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-primary-700">৳{fmt(itemSubtotal(c) + itemVat(c))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-sage-300 p-4 space-y-3">
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
                <span>Payable</span><span>৳{fmt(payableAmount)}</span>
              </div>
            </div>

            <Select
              label="Pay Mode"
              value={salesType}
              onChange={(e) => {
                const next = e.target.value;
                setSalesType(next);
                if (next !== "Card") setBankId("");
              }}
              options={((POS_PAY_MODES as readonly string[]).includes(salesType) ? [...POS_PAY_MODES] : [salesType, ...POS_PAY_MODES])
                .filter(Boolean)
                .map((m) => ({ value: m, label: m }))}
            />

            {salesType === "Card" && (
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
            <Input label="Customer Name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Walk-in name (optional)" />

            <Input label="Served By" value={servedBy} onChange={(e) => setServedBy(e.target.value)} placeholder="Staff name (optional)" />
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
                paid < payableAmount ||
                discountExceedsTotal ||
                !modifyReason.trim() ||
                (discountAmount > 0 && (!discountName.trim() || !discountContact.trim()))
              }
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
