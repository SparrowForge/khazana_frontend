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
import CustomerQuickAddModal from "@/components/customers/CustomerQuickAddModal";
import {
  fetchItems,
  fetchCustomers,
  fetchNcAdjustment,
  updateNcAdjustment,
  type AvailableItem,
  type NcCustomer,
} from "../server";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";

export default function NCAdjustmentEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { can } = usePermissions();
  const canEdit = can("NCAdjustment", "edit");
  const canAddCustomer = can("Customers", "add");

  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [customers, setCustomers] = useState<NcCustomer[]>([]);
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState("");
  /** The free text an NC entered before the customer link existed was saved
   *  with. Shown as a hint next to the empty picker so whoever is editing knows
   *  who it was for; it is never written back. */
  const [legacyRecipient, setLegacyRecipient] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  /** Qty per item as this NC was saved. Current on-hand already has that
   *  deduction applied, so it is added back when judging what the edit may
   *  commit — the same basis the server checks on. */
  const [heldStock, setHeldStock] = useState<Record<string, number>>({});

  /** Resolves with the fresh list too, so a just-created customer can be found
   *  in it and selected. */
  const loadCustomers = () =>
    fetchCustomers().then((list) => { setCustomers(list); return list; });

  /** A customer created from this screen is selected straight away, so the edit
   *  carries on where it left off. */
  const handleCustomerCreated = async (created: { id: string | number; code?: string }) => {
    try {
      const list = await loadCustomers();
      const match =
        list.find((c) => String(c.id) === String(created.id)) ??
        (created.code ? list.find((c) => c.code === created.code) : undefined);
      if (match) setCustomerId(match.id);
    } catch {
      toast.error("Customer saved, but the list didn't refresh — reload to pick them");
    }
  };

  useEffect(() => {
    if (!id) return;
    if (!canEdit) {
      toast.error("You don't have permission to edit NC adjustments");
      router.replace("/nc-adjustment/list");
      return;
    }
    fetchItems().then(setAvailableItems).catch(() => {});
    loadCustomers().catch(() => {});
    fetchNcAdjustment(id)
      .then((nc) => {
        setCode(nc.ncmstrCode ?? "");
        setDate(nc.ncmstrDate ? nc.ncmstrDate.split("T")[0] : new Date().toISOString().split("T")[0]);
        setCustomerId(nc.customer?.id ?? nc.customerId ?? "");
        setLegacyRecipient(
          nc.customer ? "" : [nc.ncmstrName, nc.ncmstrContactNo].filter(Boolean).join(" — "),
        );
        setReference(nc.ncmstrReference ?? "");
        // An NC is non-charge, so it carries no discount any more. A row saved
        // before that rule is restated at its full value on load: the discount
        // is dropped AND the line re-valued at rate × qty, because saving it
        // back with discount 0 but a still-discounted total would leave the row
        // internally inconsistent. VAT keeps the rate it was charged at, taken
        // off the saved figures before they are replaced.
        const saved = (nc.details ?? []).map((d) => {
          const quantity = Number(d.ncdetQTY ?? 0);
          const rate = Number(d.ncdetPrice ?? 0);
          const savedNet = Number(d.ncdetNetAmount ?? 0);
          const savedVat = Number(d.ncdetVATAmount ?? 0);
          const vatPct = savedNet > 0 ? (savedVat / savedNet) * 100 : 0;
          const total = Math.round(rate * quantity * 100) / 100;
          return {
            itemId: d.ncdetItemOID,
            itemCode: d.item?.itmCode ?? "",
            itemName: d.item?.itmName ?? "",
            quantity,
            rate,
            discount: 0,
            vatPercentage: vatPct,
            vat: Math.round(((total * vatPct) / 100) * 100) / 100,
            total,
          };
        });
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

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const totalVat = items.reduce((s, i) => s + i.vat, 0);
  const grandTotal = netAmount + totalVat;

  const missingCustomer = !customerId;
  const missingReference = !reference.trim();
  const incomplete = missingCustomer || missingReference;

  const handleSubmit = async () => {
    if (!id) return;
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (incomplete) { toast.error("Customer and Reference are required"); return; }
    setSubmitting(true);
    try {
      // Full edit: backend replaces the detail rows and reconciles stock, master updates.
      await updateNcAdjustment(id, { code, date, customerId, reference, items, netAmount });
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
                <div className="flex flex-col gap-1">
                  <Select
                    label="Customer *"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="Select customer..."
                    options={customers.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                    error={missingCustomer ? "Customer is required" : undefined}
                  />
                  {canAddCustomer && (
                    <button
                      type="button"
                      onClick={() => setCustomerModal(true)}
                      className="self-start inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"
                    >
                      <Plus size={12} /> Add Customer
                    </button>
                  )}
                </div>
                <Input
                  label="Reference *"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  error={missingReference ? "Reference is required" : undefined}
                />
                {/* Saving this NC replaces the old typed recipient with the
                    picked customer, so say who it used to name. */}
                {legacyRecipient && !customerId && (
                  <p className="col-span-2 text-xs text-amber-700">
                    Originally issued to “{legacyRecipient}” before customers were linked — pick the
                    matching customer to keep the record.
                  </p>
                )}
                {selectedCustomer && (
                  <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-sage-100 border border-sage-300 px-3 py-2 text-sm">
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
              <SaleItemsTable
                items={items}
                onItemsChange={setItems}
                availableItems={availableItems}
                enforceStock
                heldStock={heldStock}
                vatInclusiveTotal
                showDiscount={false}
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
                    Customer and Reference are required.
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

      <CustomerQuickAddModal
        open={customerModal}
        onClose={() => setCustomerModal(false)}
        onCreated={handleCustomerCreated}
      />
    </AppLayout>
  );
}
