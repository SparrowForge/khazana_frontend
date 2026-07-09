"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SaleItemsTable from "@/components/sales/SaleItemsTable";
import { fetchItems, fetchAssortment, updateAssortment, type AvailableItem } from "./server";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

export default function AssortmentEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { can } = usePermissions();
  const canEdit = can("Assortment", "edit");

  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState("Regular");
  const [paidAmount, setPaidAmount] = useState("0");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (!canEdit) {
      toast.error("You don't have permission to edit assortments");
      router.replace("/assortment/list");
      return;
    }
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchAssortment(id)
      .then((a) => {
        setCode(a.code);
        setDate(a.date ? a.date.split("T")[0] : new Date().toISOString().split("T")[0]);
        setType(a.type || "Regular");
        setPaidAmount(String(a.paidAmount ?? 0));
        setItems(a.items ?? []);
      })
      .catch(() => toast.error("Failed to load assortment"))
      .finally(() => setLoading(false));
  }, [id, canEdit, router]);

  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const change = parseFloat(paidAmount) - netAmount;

  const handleSubmit = async () => {
    if (!id) return;
    if (!items.length) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      await updateAssortment(id, {
        date, type, items,
        totalAmt: items.reduce((s, i) => s + i.rate * i.quantity, 0),
        discAmt: items.reduce((s, i) => s + i.discount, 0),
        netAmt: netAmount,
        customerpay: parseFloat(paidAmount) || 0,
        change: Math.max(0, change),
      });
      toast.success("Assortment updated");
      router.push("/assortment/list");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to update assortment"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Edit Assortment" subtitle={code ? `Code ${code}` : "Update assorted packaging sale"} />
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card title="Assortment Information">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Code" value={code} disabled readOnly />
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
                <Button className="w-full" onClick={handleSubmit} loading={submitting} disabled={!items.length}>Update Assortment</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
