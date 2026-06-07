"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SaleItemsTable from "@/components/sales/SaleItemsTable";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { SaleItem, Customer } from "@/types";
import toast from "react-hot-toast";

const VAT_RATE = 0.15;

export default function VatCreditSalePage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<{ id: number; itmCode: string; itmName?: string; price?: number }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [clientCode, setClientCode] = useState("");
  const [vatClnNo, setVatClnNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/items?limit=500").then((res) => setAvailableItems(res.data.data ?? res.data)).catch(() => {});
    api.get("/customers?limit=500").then((res) => setCustomers(res.data.data ?? res.data)).catch(() => {});
  }, []);

  const subtotal = items.reduce((s, i) => s + i.rate * i.quantity, 0);
  const totalDiscount = items.reduce((s, i) => s + i.discount, 0);
  const taxable = subtotal - totalDiscount;
  const vat = taxable * VAT_RATE;
  const netAmount = taxable + vat;

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (!clientCode) { toast.error("Select a customer"); return; }
    setSubmitting(true);
    try {
      await api.post("/sales/vat/credit", {
        invoiceNo, invoiceDate, clientCode, vatClnNo, items,
        totalAmount: subtotal, totalDiscount, totalVat: vat, netAmount,
      });
      toast.success("VAT credit sale created");
      setItems([]);
      setInvoiceNo("");
      setClientCode("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg ?? "Failed to create sale");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="VAT Credit Sale" subtitle="Create a VAT-enabled credit sale invoice" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Invoice Information">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Invoice No" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Auto-generated" />
              <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              <Select
                label="Customer"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                placeholder="Select customer..."
                options={customers.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
              />
              <Input label="VAT Challan No" value={vatClnNo} onChange={(e) => setVatClnNo(e.target.value)} />
            </div>
          </Card>
          <Card title="Items">
            <SaleItemsTable items={items} onItemsChange={setItems} availableItems={availableItems} />
          </Card>
        </div>
        <div>
          <Card title="Invoice Summary">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>৳ {formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>৳ {formatCurrency(totalDiscount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">VAT (15%)</span><span>৳ {formatCurrency(vat)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-2"><span>Net Amount</span><span>৳ {formatCurrency(netAmount)}</span></div>
              <Button className="w-full mt-2" onClick={handleSubmit} loading={submitting} disabled={!items.length}>Save VAT Credit Sale</Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
