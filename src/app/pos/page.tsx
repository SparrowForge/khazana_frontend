"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import toast from "react-hot-toast";
import { posProductsApi, posSalesApi, type PosProduct } from "@/lib/services/pos.service";
import { ShoppingCart, Plus, Minus, Trash2, Search } from "lucide-react";

interface CartItem {
  itemId: string;
  name: string;
  uom: string;
  price: number;
  vatPercentage: number;
  qty: number;
}

const fmt = (n: number) => n.toFixed(2);

export default function PosPage() {
  const router = useRouter();
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState("");
  const [servedBy, setServedBy] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    posProductsApi
      .getAll()
      .then(setProducts)
      .catch(() => toast.error("Failed to load products"))
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (product: PosProduct) => {
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

  const changeQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.itemId === itemId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  };

  const itemSubtotal = (c: CartItem) => c.price * c.qty;
  const itemVat = (c: CartItem) =>
    Math.round(c.price * c.qty * c.vatPercentage) / 100;

  const totalAmount = cart.reduce((s, c) => s + itemSubtotal(c), 0);
  const vatAmount = cart.reduce((s, c) => s + itemVat(c), 0);
  const payableAmount = Math.round((totalAmount + vatAmount) * 100) / 100;
  const paid = parseFloat(paidAmount) || 0;
  const change = Math.round((paid - payableAmount) * 100) / 100;

  const handleGenerateBill = async () => {
    if (!cart.length) { toast.error("Cart is empty"); return; }
    if (paid < payableAmount) { toast.error("Paid amount is less than payable"); return; }
    setSubmitting(true);
    try {
      const sale = await posSalesApi.create({
        items: cart.map((c) => ({ itemId: c.itemId, qty: c.qty })),
        paidAmount: paid,
        servedBy: servedBy || undefined,
        salesType: "Cash",
      });
      toast.success(`Invoice ${sale.invoiceNo} generated!`);
      router.push(`/pos/invoice/${sale.id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg ?? "Failed to generate bill");
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

      <div className="flex gap-5 h-[calc(100vh-11rem)]">
        {/* ─── Product Grid ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="mb-3 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-primary-500 hover:shadow-md transition-all active:scale-95 group"
                  >
                    <div className="text-2xl mb-2">🍬</div>
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
                    {Number(p.vatPercentage) > 0 && (
                      <p className="text-[10px] text-orange-500 mt-0.5">
                        +{p.vatPercentage}% VAT
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Cart + Payment ────────────────────────────────── */}
        <div className="w-80 flex flex-col gap-3 shrink-0">
          {/* Cart */}
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <ShoppingCart size={16} />
                Cart
                {cart.length > 0 && (
                  <span className="bg-primary-100 text-primary-700 text-xs rounded-full px-2 py-0.5">
                    {cart.reduce((s, c) => s + c.qty, 0)}
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">
                          ৳{fmt(c.price)} × {c.qty} {c.uom}
                          {c.vatPercentage > 0 && (
                            <span className="text-orange-400 ml-1">+{c.vatPercentage}% VAT</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(c.itemId)}
                        className="text-gray-300 hover:text-red-500 transition-colors mt-0.5"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => changeQty(c.itemId, -1)}
                          className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{c.qty}</span>
                        <button
                          onClick={() => changeQty(c.itemId, 1)}
                          className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-primary-700">
                        ৳{fmt(itemSubtotal(c) + itemVat(c))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Sub-total</span>
                <span>৳{fmt(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>VAT</span>
                <span>৳{fmt(vatAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800 pt-1.5 border-t border-gray-100 text-base">
                <span>Payable</span>
                <span>৳{fmt(payableAmount)}</span>
              </div>
            </div>

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

            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerateBill}
              loading={submitting}
              disabled={!cart.length || paid < payableAmount}
            >
              Generate Bill
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
