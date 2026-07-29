"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  fetchOrder,
  createCreditSale,
  type AvailableItem,
  type CreditCustomer,
  type OrderOption,
  type OrderLine,
} from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SaleItem } from "@/types";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function CreditSalePage() {
  const router = useRouter();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState("");
  const [poNo, setPoNo] = useState("");
  /** Invoice-level discount rate, kept as the raw input string so the field can
   *  be cleared while typing. Defaults from the order picked in the PO list. */
  const [discountPercent, setDiscountPercent] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchCustomers().then(setCustomers).catch(() => {});
  }, []);

  // The PO picker is customer-driven: choosing a customer loads that customer's
  // open (not yet invoiced) orders, and switching customer drops the PO link
  // (and the discount rate it seeded) so an invoice can never carry another
  // customer's order number or terms.
  useEffect(() => {
    setPoNo("");
    // The discount rate came off that dropped order, so it goes with it.
    setDiscountPercent("0");
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

  const poPlaceholder = !customerId
    ? "Select a customer first"
    : ordersLoading
      ? "Loading orders…"
      : orderOptions.length
        ? "No order (optional)"
        : "No open orders for this customer";

  /** An order line becomes an invoice line at the order's agreed unit price.
   *  VAT % comes from the catalog (orders don't store a rate) and mirrors
   *  SaleItemsTable's maths: VAT on the discounted value, `total` net of VAT. */
  const orderLineToSaleItem = (line: OrderLine, catalog: AvailableItem[]): SaleItem => {
    const meta = catalog.find((a) => a.id === line.itemId);
    const quantity = Number(line.qty) || 0;
    const rate = Number(line.unitPrice ?? meta?.price ?? 0) || 0;
    const pct = meta?.vatPercentage ?? 0;
    const net = r2(rate * quantity);
    return {
      itemId: line.itemId ?? "",
      itemCode: line.item?.itmCode ?? meta?.itmCode ?? "",
      itemName: line.item?.itmName ?? meta?.itmName ?? undefined,
      quantity,
      rate,
      discount: 0,
      vatPercentage: pct,
      vat: r2((net * pct) / 100),
      total: net,
    };
  };

  /** Picking a PO both links the invoice to that order (CSMaster.PONo, which is
   *  what flips the order to "Delivery Done") and bills its lines. */
  const handlePoChange = async (serial: string) => {
    setPoNo(serial);
    const order = orders.find((o) => o.serialNo === serial);
    if (!order) return; // cleared back to "no order"
    // The order's agreed discount rate rides along with the PO link — it's the
    // same basis (a % of the VAT-inclusive total) the order was quoted on, so
    // the invoice comes to what the customer agreed. Editable afterwards.
    setDiscountPercent(String(Number(order.discount ?? 0) || 0));
    if (items.length && !confirm(`Replace the ${items.length} item(s) on this invoice with the lines from order ${serial}?`)) return;
    setLoadingOrderItems(true);
    try {
      // The catalog carries the VAT rate, so a PO picked before it has landed
      // would otherwise bill at 0% VAT — wait for it rather than guess.
      const [full, catalog] = await Promise.all([
        fetchOrder(order.id),
        availableItems.length ? availableItems : fetchItems().catch(() => [] as AvailableItem[]),
      ]);
      const lines = (full.details ?? [])
        .filter((d) => !!d.itemId)
        .map((d) => orderLineToSaleItem(d, catalog));
      if (!lines.length) {
        toast.error(`Order ${serial} has no item lines — add items manually`);
        return;
      }
      setItems(lines);
      toast.success(`Loaded ${lines.length} item(s) from ${serial}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to load the order's items"));
    } finally {
      setLoadingOrderItems(false);
    }
  };

  const subtotal = r2(items.reduce((s, i) => s + i.rate * i.quantity, 0));
  const netAmount = r2(items.reduce((s, i) => s + i.total, 0));
  const lineDiscount = r2(items.reduce((s, i) => s + i.discount, 0));
  const totalVat = r2(items.reduce((s, i) => s + i.vat, 0));
  // Two discounts stack: the per-line ones (already netted off each line total)
  // and this invoice-level percent, charged on the VAT-inclusive gross — the
  // same basis the order form uses, so billing an order at its rate lands on
  // exactly the order's total. `totalDiscount` stored on the invoice is both.
  const grossAmount = r2(netAmount + totalVat);
  const discPct = Math.min(Math.max(parseFloat(discountPercent || "0") || 0, 0), 100);
  const invoiceDiscount = r2((grossAmount * discPct) / 100);
  const totalDiscount = r2(lineDiscount + invoiceDiscount);
  const grandTotal = r2(grossAmount - invoiceDiscount);

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (!customerId) { toast.error("Select a customer"); return; }
    setSubmitting(true);
    try {
      const saved = await createCreditSale({
        invoiceNo, invoiceDate, customerId, poNo, items,
        totalAmount: subtotal,
        totalDiscount, discountPercent: discPct, totalVat, netAmount,
      });
      const savedId = saved?.id ?? saved?.data?.id;
      toast.success("Credit sale created");
      setItems([]);
      setInvoiceNo("");
      setCustomerId("");
      setPoNo("");
      setDiscountPercent("0");
      // Straight to the invoice so the user can pick a print format.
      if (savedId) router.push(`/sales/credit/invoice/${savedId}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to create sale"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Credit Sale" subtitle="Create a new credit sale invoice" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Invoice Information">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Invoice No" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Auto-generated" />
              <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              <Select
                label="Customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Select customer..."
                options={customers.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
              />
              {/* PO No is the order this invoice fulfils — picking one stores the
                  order's number on the credit sale (CSMaster.PONo), which is what
                  flips that order to "Delivery Done" on the order list. The list
                  only ever holds the selected customer's un-invoiced orders. */}
              <Select
                label="PO No (Order)"
                value={poNo}
                onChange={(e) => handlePoChange(e.target.value)}
                disabled={!customerId || ordersLoading || loadingOrderItems}
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
            <SaleItemsTable items={items} onItemsChange={setItems} availableItems={availableItems} />
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
              {/* Whole-invoice discount, taken off the VAT-inclusive gross so an
                  invoice raised against an order at that order's rate totals the
                  same as the order. Picking a PO seeds this; it stays editable. */}
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
                Save Credit Sale
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
