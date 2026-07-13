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
import {
  fetchItems,
  fetchCustomers,
  fetchCreditSale,
  updateCreditSale,
  type AvailableItem,
  type CreditCustomer,
} from "./server";
import { formatCurrency } from "@/lib/utils";
import { SaleItem } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

export default function CreditSaleEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { can } = usePermissions();
  const canEdit = can("CreditSales", "edit");

  const [items, setItems] = useState<SaleItem[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState("");
  const [poNo, setPoNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (!canEdit) {
      toast.error("You don't have permission to edit credit sales");
      router.replace("/sales");
      return;
    }
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchCustomers().then(setCustomers).catch(() => {});
    fetchCreditSale(id)
      .then((sale) => {
        setInvoiceNo(sale.invoiceNo ?? "");
        setInvoiceDate(sale.invoiceDate ? sale.invoiceDate.split("T")[0] : new Date().toISOString().split("T")[0]);
        setCustomerId(sale.customerId ?? "");
        setPoNo(sale.poNo ?? "");
        setItems(sale.items ?? []);
      })
      .catch(() => toast.error("Failed to load credit sale"))
      .finally(() => setLoading(false));
  }, [id, canEdit, router]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const subtotal = items.reduce((s, i) => s + i.rate * i.quantity, 0);
  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const totalDiscount = items.reduce((s, i) => s + i.discount, 0);
  const totalVat = items.reduce((s, i) => s + i.vat, 0);
  const grandTotal = netAmount + totalVat;

  const handleSubmit = async () => {
    if (!id) return;
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (!customerId) { toast.error("Select a customer"); return; }
    setSubmitting(true);
    try {
      // Full edit: master fields update; detail lines are purged then recreated.
      await updateCreditSale(id, {
        invoiceDate, customerId, poNo, items,
        totalAmount: subtotal,
        totalDiscount, totalVat,
      });
      toast.success("Credit sale updated");
      router.push("/sales");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to update sale"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Edit Credit Sale" subtitle={invoiceNo ? `Invoice ${invoiceNo}` : "Update credit sale invoice"} />
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card title="Invoice Information">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Invoice No" value={invoiceNo} disabled readOnly />
                <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                <Select
                  label="Customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="Select customer..."
                  options={customers.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                />
                <Input label="PO No" value={poNo} onChange={(e) => setPoNo(e.target.value)} placeholder="Optional" />
                {selectedCustomer && (
                  <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
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
              <SaleItemsTable items={items} onItemsChange={setItems} availableItems={availableItems} />
            </Card>
          </div>
          <div>
            <Card title="Invoice Summary">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>৳ {formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span>৳ {formatCurrency(totalDiscount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Net Amount</span>
                  <span>৳ {formatCurrency(netAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">VAT Amount</span>
                  <span>৳ {formatCurrency(totalVat)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total Payable</span>
                  <span>৳ {formatCurrency(grandTotal)}</span>
                </div>
                <Button className="w-full mt-4" onClick={handleSubmit} loading={submitting} disabled={!items.length}>
                  Update Credit Sale
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push(`/sales/credit/invoice/${id}`)}
                  disabled={!id}
                >
                  View / Print Invoice
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
