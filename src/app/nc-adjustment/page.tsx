"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SaleItemsTable from "@/components/sales/SaleItemsTable";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import toast from "react-hot-toast";

export default function NCAdjustmentPage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<{ id: number; itmCode: string; itmName?: string; price?: number }[]>([]);
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [name, setName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/items?limit=500").then((res) => setAvailableItems(res.data.data ?? res.data)).catch(() => {});
  }, []);

  const netAmount = items.reduce((s, i) => s + i.total, 0);

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      await api.post("/nc", { code, date, name, contactNo, reference, items, netAmount });
      toast.success("NC Adjustment saved");
      setItems([]);
      setCode(""); setName(""); setContactNo(""); setReference("");
    } catch { toast.error("Failed to save"); } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="NC Adjustment" subtitle="Negative credit / return adjustment" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="NC Information">
            <div className="grid grid-cols-2 gap-4">
              <Input label="NC Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto-generated" />
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Contact No" value={contactNo} onChange={(e) => setContactNo(e.target.value)} />
              <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} className="col-span-2" />
            </div>
          </Card>
          <Card title="Items">
            <SaleItemsTable items={items} onItemsChange={setItems} availableItems={availableItems} />
          </Card>
        </div>
        <div>
          <Card title="Summary">
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>Net Amount</span>
                <span>৳ {formatCurrency(netAmount)}</span>
              </div>
              <Button className="w-full" onClick={handleSubmit} loading={submitting} disabled={!items.length}>Save NC Adjustment</Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
