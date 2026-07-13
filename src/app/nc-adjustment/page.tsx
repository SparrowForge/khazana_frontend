"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SaleItemsTable from "@/components/sales/SaleItemsTable";
import { fetchItems, createNcAdjustment, type AvailableItem } from "./server";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

export default function NCAdjustmentPage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [name, setName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
  }, []);

  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const totalVat = items.reduce((s, i) => s + i.vat, 0);
  const grandTotal = netAmount + totalVat;

  // Name / Contact No / Reference are mandatory (enforced server-side too) —
  // an NC with no attribution can't be audited.
  const missingName = !name.trim();
  const missingContact = !contactNo.trim();
  const missingReference = !reference.trim();
  const incomplete = missingName || missingContact || missingReference;

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (incomplete) { toast.error("Name, Contact No and Reference are required"); return; }
    setSubmitting(true);
    try {
      const saved = await createNcAdjustment({ code, date, name, contactNo, reference, items, netAmount });
      const savedCode = saved?.ncmstrCode ?? saved?.data?.ncmstrCode;
      toast.success(savedCode ? `NC Adjustment saved — ${savedCode}` : "NC Adjustment saved");
      setItems([]);
      setCode(""); setName(""); setContactNo(""); setReference("");
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save")); } finally { setSubmitting(false); }
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
              <Input
                label="Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={missingName ? "Name is required" : undefined}
              />
              <Input
                label="Contact No *"
                value={contactNo}
                onChange={(e) => setContactNo(e.target.value)}
                error={missingContact ? "Contact No is required" : undefined}
              />
              <Input
                label="Reference *"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="col-span-2"
                error={missingReference ? "Reference is required" : undefined}
              />
            </div>
          </Card>
          <Card title="Items">
            <SaleItemsTable items={items} onItemsChange={setItems} availableItems={availableItems} />
          </Card>
        </div>
        <div>
          <Card title="Summary">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Net Amount</span>
                <span>৳ {formatCurrency(netAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT Amount</span>
                <span>৳ {formatCurrency(totalVat)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Total</span>
                <span>৳ {formatCurrency(grandTotal)}</span>
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                loading={submitting}
                disabled={!items.length || incomplete}
              >
                Save NC Adjustment
              </Button>
              {incomplete && (
                <p className="text-xs text-red-500 text-center">
                  Name, Contact No and Reference are required.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
