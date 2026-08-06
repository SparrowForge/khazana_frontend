"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SaleItemsTable from "@/components/sales/SaleItemsTable";
import {
  fetchItems,
  fetchNcAdjustment,
  updateNcAdjustment,
  type AvailableItem,
} from "../server";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

export default function NCAdjustmentEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { can } = usePermissions();
  const canEdit = can("NCAdjustment", "edit");

  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [name, setName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /** Qty per item as this NC was saved. Current on-hand already has that
   *  deduction applied, so it is added back when judging what the edit may
   *  commit — the same basis the server checks on. */
  const [heldStock, setHeldStock] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id) return;
    if (!canEdit) {
      toast.error("You don't have permission to edit NC adjustments");
      router.replace("/nc-adjustment/list");
      return;
    }
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchNcAdjustment(id)
      .then((nc) => {
        setCode(nc.ncmstrCode ?? "");
        setDate(nc.ncmstrDate ? nc.ncmstrDate.split("T")[0] : new Date().toISOString().split("T")[0]);
        setName(nc.ncmstrName ?? "");
        setContactNo(nc.ncmstrContactNo ?? "");
        setReference(nc.ncmstrReference ?? "");
        const saved = (nc.details ?? []).map((d) => ({
          itemId: d.ncdetItemOID,
          itemCode: d.item?.itmCode ?? "",
          itemName: d.item?.itmName ?? "",
          quantity: Number(d.ncdetQTY ?? 0),
          rate: Number(d.ncdetPrice ?? 0),
          discount: Number(d.ncdetDiscount ?? 0),
          vat: Number(d.ncdetVATAmount ?? 0),
          total: Number(d.ncdetNetAmount ?? 0),
        }));
        setItems(saved);
        setHeldStock(
          saved.reduce<Record<string, number>>((acc, it) => {
            acc[it.itemId] = Math.round(((acc[it.itemId] ?? 0) + it.quantity) * 100) / 100;
            return acc;
          }, {}),
        );
      })
      .catch(() => toast.error("Failed to load NC adjustment"))
      .finally(() => setLoading(false));
  }, [id, canEdit, router]);

  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const totalVat = items.reduce((s, i) => s + i.vat, 0);
  const grandTotal = netAmount + totalVat;

  const missingName = !name.trim();
  const missingContact = !contactNo.trim();
  const missingReference = !reference.trim();
  const incomplete = missingName || missingContact || missingReference;

  const handleSubmit = async () => {
    if (!id) return;
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (incomplete) { toast.error("Name, Contact No and Reference are required"); return; }
    setSubmitting(true);
    try {
      // Full edit: backend replaces the detail rows and reconciles stock, master updates.
      await updateNcAdjustment(id, { code, date, name, contactNo, reference, items, netAmount });
      toast.success("NC Adjustment updated");
      router.push("/nc-adjustment/list");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Edit NC Adjustment" subtitle="Update header and items — stock is re-checked and re-reconciled on save" />
      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : (
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
              <SaleItemsTable
                items={items}
                onItemsChange={setItems}
                availableItems={availableItems}
                enforceStock
                heldStock={heldStock}
                vatInclusiveTotal
              />
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
                  Update NC Adjustment
                </Button>
                {incomplete && (
                  <p className="text-xs text-red-500 text-center">
                    Name, Contact No and Reference are required.
                  </p>
                )}
                <Button variant="secondary" className="w-full" onClick={() => router.push(`/nc-adjustment/invoice/${id}`)}>
                  View Invoice
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => router.push("/nc-adjustment/list")}>Cancel</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
