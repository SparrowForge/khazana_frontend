"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SaleItemsTable from "@/components/sales/SaleItemsTable";
import {
  fetchItems,
  fetchCustomers,
  fetchOrdersForCustomer,
  fetchCreditSale,
  updateCreditSale,
  type AvailableItem,
  type CreditCustomer,
  type OrderOption,
} from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SaleItem } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function CreditSaleEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { can } = usePermissions();
  const canEdit = can("CreditSales", "edit");

  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState("");
  const [poNo, setPoNo] = useState("");
  /** Invoice-level discount rate as saved — kept as the raw input string so the
   *  field can be cleared while typing. */
  const [discountPercent, setDiscountPercent] = useState("0");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /** The customer the invoice was saved with. Reloading the PO list must not
   *  wipe the saved PO when the form first hydrates — only a real switch to a
   *  different customer does. */
  const savedCustomerId = useRef("");
  /** Qty per item as this invoice was saved. Current on-hand already has that
   *  deduction applied, so it is added back when judging what the edit may
   *  commit — the same basis the server checks on. */
  const [heldStock, setHeldStock] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id) return;
    if (!canEdit) {
      toast.error("You don't have permission to edit credit sales");
      router.replace("/sales");
      return;
    }
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchCustomers().then(setCustomers).catch(() => {});
    fetchCreditSale(id)
      .then((sale) => {
        setInvoiceNo(sale.invoiceNo ?? "");
        setInvoiceDate(sale.invoiceDate ? sale.invoiceDate.split("T")[0] : new Date().toISOString().split("T")[0]);
        savedCustomerId.current = sale.customerId ?? "";
        setCustomerId(sale.customerId ?? "");
        setPoNo(sale.poNo ?? "");
        setDiscountPercent(String(sale.discountPercent ?? 0));
        const saved = sale.items ?? [];
        setItems(saved);
        setHeldStock(
          saved.reduce<Record<string, number>>((acc, it) => {
            acc[it.itemId] = r2((acc[it.itemId] ?? 0) + it.quantity);
            return acc;
          }, {}),
        );
      })
      .catch(() => toast.error("Failed to load credit sale"))
      .finally(() => setLoading(false));
  }, [id, canEdit, router]);

  // Same customer-driven PO list as the create form: the picker only ever
  // offers the selected customer's un-invoiced orders.
  useEffect(() => {
    if (customerId !== savedCustomerId.current) setPoNo("");
    if (!customerId) {
      setOrders([]);
      return;
    }
    let stale = false;
    setOrdersLoading(true);
    fetchOrdersForCustomer(customerId)
      .then((rows) => { if (!stale) setOrders(rows); })
      .catch(() => {
        if (stale) return;
        setOrders([]);
        toast.error("Failed to load this customer's orders");
      })
      .finally(() => { if (!stale) setOrdersLoading(false); });
    // A slow response for the previous customer must not land on the new one.
    return () => { stale = true; };
  }, [customerId]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const orderOptions = orders
    .filter((o) => !!o.serialNo)
    .map((o) => ({
      value: o.serialNo!,
      label: [
        o.serialNo!,
        o.orderDate ? formatDate(o.orderDate) : null,
        o.totalPrice != null ? `৳ ${formatCurrency(o.totalPrice)}` : null,
      ].filter(Boolean).join(" — "),
    }));
  // The invoice's own PO is "Delivery Done" (because of this very invoice) and
  // so never comes back in the pending list — keep it as an option, or editing
  // anything else here would silently drop the order link.
  if (poNo && !orderOptions.some((o) => o.value === poNo)) {
    orderOptions.unshift({ value: poNo, label: `${poNo} (current)` });
  }

  const poPlaceholder = !customerId
    ? "Select a customer first"
    : ordersLoading
      ? "Loading orders…"
      : orderOptions.length
        ? "No order (optional)"
        : "No open orders for this customer";

  const subtotal = r2(items.reduce((s, i) => s + i.rate * i.quantity, 0));
  const netAmount = r2(items.reduce((s, i) => s + i.total, 0));
  const lineDiscount = r2(items.reduce((s, i) => s + i.discount, 0));
  const totalVat = r2(items.reduce((s, i) => s + i.vat, 0));
  // Same two-tier discount as the create form: per-line amounts (already inside
  // each line total) plus an invoice-level percent on the VAT-inclusive gross.
  const grossAmount = r2(netAmount + totalVat);
  const discPct = Math.min(Math.max(parseFloat(discountPercent || "0") || 0, 0), 100);
  const invoiceDiscount = r2((grossAmount * discPct) / 100);
  const totalDiscount = r2(lineDiscount + invoiceDiscount);
  const grandTotal = r2(grossAmount - invoiceDiscount);

  const handleSubmit = async () => {
    if (!id) return;
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (!customerId) { toast.error("Select a customer"); return; }
    setSubmitting(true);
    try {
      // Full edit: master fields update; detail lines are purged then recreated.
      await updateCreditSale(id, {
        invoiceDate, customerId, poNo, items,
        totalAmount: subtotal,
        totalDiscount, discountPercent: discPct, totalVat,
      });
      toast.success("Credit sale updated");
      router.push("/sales");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to update sale"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Edit Credit Sale" subtitle={invoiceNo ? `Invoice ${invoiceNo}` : "Update credit sale invoice"} />
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card title="Invoice Information">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Invoice No" value={invoiceNo} disabled readOnly />
                <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                <Select
                  label="Customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="Select customer..."
                  options={customers.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                />
                {/* Same customer-driven order picker as the create form. A PO
                    already on the invoice that isn't in the fetched orders
                    (this invoice's own order, legacy free text, or one raised
                    for another customer) is kept as an option so editing the
                    rest of the invoice can't silently drop the link. */}
                <Select
                  label="PO No (Order)"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  disabled={!customerId || ordersLoading}
                  placeholder={poPlaceholder}
                  options={orderOptions}
                />
                {selectedCustomer && (
                  <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                    <span className="text-gray-500">
                      Contact No:{" "}
                      <span className="font-medium text-gray-800">
                        {selectedCustomer.mobile || "— not on file —"}
                      </span>
                    </span>
                    {selectedCustomer.address && (
                      <span className="text-gray-500">
                        Address: <span className="font-medium text-gray-800">{selectedCustomer.address}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
            <Card title="Items">
              <SaleItemsTable
                items={items}
                onItemsChange={setItems}
                availableItems={availableItems}
                enforceStock
                heldStock={heldStock}
              />
            </Card>
          </div>
          <div>
            <Card title="Invoice Summary">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>৳ {formatCurrency(subtotal)}</span>
                </div>
                {lineDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Item Discount</span>
                    <span>- ৳ {formatCurrency(lineDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Net Amount</span>
                  <span>৳ {formatCurrency(netAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">VAT Amount</span>
                  <span>৳ {formatCurrency(totalVat)}</span>
                </div>
                {/* The invoice-level discount as it was saved. Unlike the create
                    form, changing the PO here doesn't re-seed it — editing an
                    invoice keeps the rate it was actually issued at unless the
                    rate itself is changed. */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Gross Amount</span>
                    <span>৳ {formatCurrency(grossAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="invoice-discount-pct" className="text-sm text-gray-500">
                      Discount (%)
                    </label>
                    <input
                      id="invoice-discount-pct"
                      type="number" min="0" max="100" step="0.01" inputMode="decimal"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className="w-24 text-right border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
                    />
                  </div>
                  {invoiceDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Discount ({discPct}%)</span>
                      <span className="font-medium text-red-600">- ৳ {formatCurrency(invoiceDiscount)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total Payable</span>
                  <span>৳ {formatCurrency(grandTotal)}</span>
                </div>
                <Button className="w-full mt-4" onClick={handleSubmit} loading={submitting} disabled={!items.length}>
                  Update Credit Sale
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push(`/sales/credit/invoice/${id}`)}
                  disabled={!id}
                >
                  View / Print Invoice
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
