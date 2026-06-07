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
import { SaleItem } from "@/types";
import toast from "react-hot-toast";

export default function CashSalePage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<{ id: number; itmCode: string; itmName?: string; price?: number }[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState("0");
  const [discountRemarks, setDiscountRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/items?limit=500").then((res) => {
      setAvailableItems(res.data.data ?? res.data);
    }).catch(() => {});
  }, []);

  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const change = parseFloat(paidAmount) - netAmount;

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      await api.post("/sales/cash", {
        invoiceNo, invoiceDate, paymentMethod, items,
        totalAmount: items.reduce((s, i) => s + i.rate * i.quantity, 0),
        totalDiscount: items.reduce((s, i) => s + i.discount, 0),
        netAmount,
        paidAmount: parseFloat(paidAmount),
        changeAmount: change,
        discountRemarks,
      });
      toast.success("Cash sale created");
      setItems([]);
      setInvoiceNo("");
      setPaidAmount("0");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg ?? "Failed to create sale");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Cash Sale" subtitle="Create a new cash sale transaction" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Sale Information">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Invoice No" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Auto-generated" />
              <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
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
              <Input label="Discount Remarks" value={discountRemarks} onChange={(e) => setDiscountRemarks(e.target.value)} />
            </div>
          </Card>
          <Card title="Items">
            <SaleItemsTable items={items} onItemsChange={setItems} availableItems={availableItems} />
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Payment Summary">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Net Amount</span>
                <span className="font-semibold">৳ {formatCurrency(netAmount)}</span>
              </div>
              <Input
                label="Customer Paid"
                type="number" min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Change</span>
                <span className={`font-semibold ${change < 0 ? "text-red-600" : "text-green-600"}`}>
                  ৳ {formatCurrency(Math.max(0, change))}
                </span>
              </div>
              <Button className="w-full mt-4" onClick={handleSubmit} loading={submitting} disabled={!items.length}>
                Save Cash Sale
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
