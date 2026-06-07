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

export default function AssortmentPage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<{ id: number; itmCode: string; itmName?: string; price?: number }[]>([]);
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState("Regular");
  const [paidAmount, setPaidAmount] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/items?limit=500").then((res) => setAvailableItems(res.data.data ?? res.data)).catch(() => {});
  }, []);

  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const change = parseFloat(paidAmount) - netAmount;

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      await api.post("/assortment", {
        code, date, type, items,
        totalAmt: items.reduce((s, i) => s + i.rate * i.quantity, 0),
        discAmt: items.reduce((s, i) => s + i.discount, 0),
        netAmt: netAmount,
        customerpay: parseFloat(paidAmount),
        change: Math.max(0, change),
      });
      toast.success("Assortment sale saved");
      setItems([]);
      setCode(""); setPaidAmount("0");
    } catch { toast.error("Failed to save"); } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Assortment Sale" subtitle="Special assorted packaging sale" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Assortment Information">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto-generated" />
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}
                options={[{ value: "Regular", label: "Regular" }, { value: "Special", label: "Special" }]} />
            </div>
          </Card>
          <Card title="Items">
            <SaleItemsTable items={items} onItemsChange={setItems} availableItems={availableItems} />
          </Card>
        </div>
        <div>
          <Card title="Payment">
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>Net Amount</span>
                <span>৳ {formatCurrency(netAmount)}</span>
              </div>
              <Input label="Customer Paid" type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Change</span>
                <span className={change < 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>৳ {formatCurrency(Math.max(0, change))}</span>
              </div>
              <Button className="w-full" onClick={handleSubmit} loading={submitting} disabled={!items.length}>Save Assortment</Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
