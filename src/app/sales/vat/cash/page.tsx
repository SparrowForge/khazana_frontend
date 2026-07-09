"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SaleItemsTable from "@/components/sales/SaleItemsTable";
import { fetchItems, createVatCashSale, type AvailableItem } from "./server";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

const VAT_RATE = 0.15;

export default function VatCashSalePage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [vatClnNo, setVatClnNo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
  }, []);

  const subtotal = items.reduce((s, i) => s + i.rate * i.quantity, 0);
  const totalDiscount = items.reduce((s, i) => s + i.discount, 0);
  const taxable = subtotal - totalDiscount;
  const vat = taxable * VAT_RATE;
  const netAmount = taxable + vat;
  const change = parseFloat(paidAmount) - netAmount;

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      await createVatCashSale({
        invoiceNo, invoiceDate, vatClnNo, paymentMethod, items,
        totalAmount: subtotal, totalDiscount, totalVat: vat, netAmount,
        paidAmount: parseFloat(paidAmount), changeAmount: Math.max(0, change),
      });
      toast.success("VAT cash sale created");
      setItems([]);
      setInvoiceNo("");
      setPaidAmount("0");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to create sale"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="VAT Cash Sale" subtitle="Create a VAT-enabled cash sale" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Sale Information">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Invoice No" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Auto-generated" />
              <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              <Input label="VAT Challan No" value={vatClnNo} onChange={(e) => setVatClnNo(e.target.value)} />
              <Select
                label="Payment Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={[
                  { value: "Cash", label: "Cash" },
                  { value: "Card", label: "Card" },
                  { value: "Mobile", label: "Mobile Banking" },
                ]}
              />
            </div>
          </Card>
          <Card title="Items">
            <SaleItemsTable items={items} onItemsChange={setItems} availableItems={availableItems} />
          </Card>
        </div>
        <div>
          <Card title="Payment Summary">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>৳ {formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>৳ {formatCurrency(totalDiscount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">VAT (15%)</span><span>৳ {formatCurrency(vat)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-2"><span>Net Amount</span><span>৳ {formatCurrency(netAmount)}</span></div>
              <Input label="Customer Paid" type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              <div className="flex justify-between"><span className="text-gray-500">Change</span><span className={change < 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>৳ {formatCurrency(Math.max(0, change))}</span></div>
              <Button className="w-full mt-2" onClick={handleSubmit} loading={submitting} disabled={!items.length}>Save VAT Cash Sale</Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
