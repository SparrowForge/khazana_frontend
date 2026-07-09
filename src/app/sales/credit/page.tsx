"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SaleItemsTable from "@/components/sales/SaleItemsTable";
import { fetchItems, fetchCustomers, createCreditSale, type AvailableItem } from "./server";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

export default function CreditSalePage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [customers, setCustomers] = useState<{ id: string; code: string; name: string }[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState("");
  const [poNo, setPoNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchCustomers().then(setCustomers).catch(() => {});
  }, []);

  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const totalDiscount = items.reduce((s, i) => s + i.discount, 0);

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (!customerId) { toast.error("Select a customer"); return; }
    setSubmitting(true);
    try {
      await createCreditSale({
        invoiceNo, invoiceDate, customerId, poNo, items,
        totalAmount: items.reduce((s, i) => s + i.rate * i.quantity, 0),
        totalDiscount, netAmount,
      });
      toast.success("Credit sale created");
      setItems([]);
      setInvoiceNo("");
      setCustomerId("");
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
              <Input label="PO No" value={poNo} onChange={(e) => setPoNo(e.target.value)} placeholder="Optional" />
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
                <span>৳ {formatCurrency(items.reduce((s, i) => s + i.rate * i.quantity, 0))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span>৳ {formatCurrency(totalDiscount)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Net Amount</span>
                <span>৳ {formatCurrency(netAmount)}</span>
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
