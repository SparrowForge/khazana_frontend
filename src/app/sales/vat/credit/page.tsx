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
import ItemQuickAddModal from "@/components/catalog/ItemQuickAddModal";
import CustomerQuickAddModal from "@/components/customers/CustomerQuickAddModal";
import { fetchItems, fetchCustomers, createVatCreditSale, type AvailableItem } from "./server";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";

const VAT_RATE = 0.15;

export default function VatCreditSalePage() {
  const router = useRouter();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [customers, setCustomers] = useState<{ id: number; code: string; name: string }[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [clientCode, setClientCode] = useState("");
  const [vatClnNo, setVatClnNo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);

  const { can } = usePermissions();
  const canAddItem = can("Items", "add") && can("Pricing", "add");
  const canAddCustomer = can("Customers", "add");

  const loadItems = () => fetchItems().then(setAvailableItems).catch(() => {});
  const loadCustomers = () =>
    fetchCustomers().then((list) => { setCustomers(list); return list; });

  useEffect(() => {
    loadItems();
    loadCustomers().catch(() => {});
  }, []);

  /** This invoice is keyed by customer *code*, so the new customer is matched
   *  in the refreshed list and selected by code. */
  const handleCustomerCreated = async (created: { id: string | number; code?: string }) => {
    try {
      const list = await loadCustomers();
      const match =
        (created.code ? list.find((c) => c.code === created.code) : undefined) ??
        list.find((c) => String(c.id) === String(created.id));
      if (match) setClientCode(match.code);
    } catch {
      toast.error("Customer saved, but the list didn't refresh — reload to pick them");
    }
  };

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
      const saved = await createVatCreditSale({
        invoiceNo, invoiceDate, clientCode, vatClnNo, items,
        totalAmount: subtotal, totalDiscount, totalVat: vat, netAmount,
      });
      toast.success("VAT credit sale created");
      setItems([]);
      setInvoiceNo("");
      setClientCode("");
      // Straight to the invoice so the user can pick a print format.
      if (saved?.id) router.push(`/sales/vat/credit/invoice/${saved.id}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to create sale"));
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
              <div className="flex flex-col gap-1">
                <Select
                  label="Customer"
                  value={clientCode}
                  onChange={(e) => setClientCode(e.target.value)}
                  placeholder="Select customer..."
                  options={customers.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
                />
                {canAddCustomer && (
                  <button
                    type="button"
                    onClick={() => setCustomerModal(true)}
                    className="self-start inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"
                  >
                    <Plus size={12} /> New customer
                  </button>
                )}
              </div>
              <Input label="VAT Challan No" value={vatClnNo} onChange={(e) => setVatClnNo(e.target.value)} />
            </div>
          </Card>
          <Card
            title="Items"
            action={canAddItem ? (
              <Button variant="light" size="sm" onClick={() => setItemModal(true)}>
                <Plus size={14} /> New Item
              </Button>
            ) : undefined}
          >
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

      <ItemQuickAddModal
        open={itemModal}
        onClose={() => setItemModal(false)}
        onCreated={loadItems}
      />
      <CustomerQuickAddModal
        open={customerModal}
        onClose={() => setCustomerModal(false)}
        onCreated={handleCustomerCreated}
      />
    </AppLayout>
  );
}
