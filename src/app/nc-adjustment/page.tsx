"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SaleItemsTable from "@/components/sales/SaleItemsTable";
import CustomerQuickAddModal from "@/components/customers/CustomerQuickAddModal";
import { fetchItems, fetchCustomers, createNcAdjustment, type AvailableItem, type NcCustomer } from "./server";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";

export default function NCAdjustmentPage() {
  const router = useRouter();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [customers, setCustomers] = useState<NcCustomer[]>([]);
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The recipient can be someone who isn't on file yet — registering them from
  // here beats abandoning a half-filled NC.
  const [customerModal, setCustomerModal] = useState(false);

  const { can } = usePermissions();
  const canAddCustomer = can("Customers", "add");

  /** Resolves with the fresh list too, so a just-created customer can be found
   *  in it and selected. */
  const loadCustomers = () =>
    fetchCustomers().then((list) => { setCustomers(list); return list; });

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
    loadCustomers().catch(() => {});
  }, []);

  /** A customer created from this screen is selected straight away, so the NC
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

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const totalVat = items.reduce((s, i) => s + i.vat, 0);
  const grandTotal = netAmount + totalVat;

  // Customer and Reference are mandatory (enforced server-side too) — an NC with
  // no attribution can't be audited. The recipient is a registered customer now,
  // so the name and number on the document are the ones on file.
  const missingCustomer = !customerId;
  const missingReference = !reference.trim();
  const incomplete = missingCustomer || missingReference;

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (incomplete) { toast.error("Customer and Reference are required"); return; }
    setSubmitting(true);
    try {
      const saved = await createNcAdjustment({ code, date, customerId, reference, items, netAmount });
      const savedCode = saved?.ncmstrCode ?? saved?.data?.ncmstrCode;
      const savedId = saved?.id ?? saved?.data?.id;
      toast.success(savedCode ? `NC Adjustment saved — ${savedCode}` : "NC Adjustment saved");
      setItems([]);
      setCode(""); setCustomerId(""); setReference("");
      // Hand off to the printable invoice, the same way a sale does after checkout.
      if (savedId) router.push(`/nc-adjustment/invoice/${savedId}`);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save")); } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="NC Adjustment" subtitle="Non-charge issue — deducts stock, checked against on-hand qty" />
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
              {/* The contact number is whatever is on file for the picked
                  customer — an NC no longer carries its own typed one. */}
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
            <SaleItemsTable items={items} onItemsChange={setItems} availableItems={availableItems} enforceStock vatInclusiveTotal />
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
                  Customer and Reference are required.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* A recipient registered from the NC itself — the list is refreshed and
          the new record selected, so the form carries on. */}
      <CustomerQuickAddModal
        open={customerModal}
        onClose={() => setCustomerModal(false)}
        onCreated={handleCustomerCreated}
      />
    </AppLayout>
  );
}
