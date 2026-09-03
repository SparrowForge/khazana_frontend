"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Pagination from "@/components/ui/Pagination";
import { Plus, Trash2, Edit2, Eye, Printer, FileText, FileSpreadsheet } from "lucide-react";
import {
  fetchOrders, fetchOrder, createOrder, updateOrder, deleteOrder, fetchCustomers, fetchCustomerBalance,
  fetchItems, fetchBranches,
  type Order, type OrderRecord, type Customer, type AvailableItem, type BranchInfo,
} from "./server";
import CustomerQuickAddModal from "@/components/customers/CustomerQuickAddModal";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import {
  previewOrderInvoice, printOrderInvoice, exportOrderInvoicePdf,
  type OrderInvoiceData, type OrderInvoiceLine,
} from "@/lib/export/orderInvoiceDocument";
import { exportExcel, type ExportColumn } from "@/lib/export/reportExport";

interface OrderLine { itemId: string; qty: string; unitPrice: string; vatPercentage?: number; }

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([{ itemId: "", qty: "1", unitPrice: "0" }]);
  const [form, setForm] = useState({ clientId: "", orderDate: new Date().toISOString().split("T")[0], deliveryDate: "", deliveryAddress: "", advance: "0", discount: "0" });
  const [saving, setSaving] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  /** The picked customer's outstanding balance as it stands now, before this
   *  order. `null` while it is being read or when no customer is picked. */
  const [previousDue, setPreviousDue] = useState<number | null>(null);
  const [dueLoading, setDueLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<OrderRecord | null>(null);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();
  const { can } = usePermissions();
  const canAdd = can("Orders", "add");
  const canAddCustomer = can("Customers", "add");
  const canEdit = can("Orders", "edit");
  const canDelete = can("Orders", "delete");

  const load = () => {
    setLoading(true);
    fetchOrders({ page, limit })
      .then(({ items, meta }) => { setOrders(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  const loadCustomers = () =>
    fetchCustomers().then((list) => { setCustomers(list); return list; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    loadCustomers().catch(() => {});
    fetchItems().then(setAvailableItems).catch(() => {});
    fetchBranches().then(setBranches).catch(() => {});
  }, []);
  useEffect(load, [page, limit, refreshKey, setMeta]);

  /** A customer registered from this form is selected straight away, so the
   *  order carries on where it left off. The refreshed list is only the first
   *  page of customers, so a new name that sorts past it is folded in by hand
   *  rather than leaving the picker unable to show who was just created. */
  const handleCustomerCreated = async (created: { id: string | number; code?: string; name?: string; address?: string }) => {
    const id = String(created.id);
    try {
      const list = await loadCustomers();
      const match =
        list.find((c) => String(c.id) === id) ??
        (created.code ? list.find((c) => c.code === created.code) : undefined);
      if (match) {
        setForm((f) => ({ ...f, clientId: match.id, deliveryAddress: match.address ?? "" }));
        return;
      }
      const fallback: Customer = { id, code: created.code ?? "", name: created.name ?? "", address: created.address };
      setCustomers([fallback, ...list]);
      setForm((f) => ({ ...f, clientId: id, deliveryAddress: created.address ?? "" }));
    } catch {
      toast.error("Customer saved, but the list didn't refresh — reload to pick them");
    }
  };

  // The standing due is read per customer, not held on the list: it moves with
  // every invoice, receipt and advance taken anywhere, so the form asks for it
  // when the customer is picked. A slow answer for the customer who was just
  // dropped must never land on the one picked after them.
  useEffect(() => {
    if (!modal || !form.clientId) { setPreviousDue(null); setDueLoading(false); return; }
    let stale = false;
    setDueLoading(true);
    fetchCustomerBalance(form.clientId)
      .then((b) => { if (!stale) setPreviousDue(Number(b?.balance ?? 0) || 0); })
      .catch(() => { if (!stale) setPreviousDue(null); })
      .finally(() => { if (!stale) setDueLoading(false); });
    return () => { stale = true; };
  }, [form.clientId, modal]);

  const addLine = () => setLines([...lines, { itemId: "", qty: "1", unitPrice: "0" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, f: keyof OrderLine, v: string) =>
    setLines(lines.map((l, idx) => {
      if (idx !== i) return l;
      if (f === "itemId") {
        const item = availableItems.find((it) => it.id === v);
        return { ...l, itemId: v, unitPrice: String(item?.price ?? 0), vatPercentage: item?.vatPercentage ?? 0 };
      }
      return { ...l, [f]: v };
    }));

  // Grand Total is the pre-discount line-item sum. Discount is a % of the
  // VAT-inclusive gross (MRP) — the same basis the POS terminal discounts on,
  // so an order and a counter sale of the same basket net out identically.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const totalPrice = r2(lines.reduce((s, l) => s + parseFloat(l.qty || "0") * parseFloat(l.unitPrice || "0"), 0));
  const vatAmount = r2(lines.reduce((s, l) => {
    const lineSubtotal = parseFloat(l.qty || "0") * parseFloat(l.unitPrice || "0");
    const lineVat = lineSubtotal * ((l.vatPercentage ?? 0) / 100);
    return s + lineVat;
  }, 0));
  const grossAmount = r2(totalPrice + vatAmount);
  const discountPercent = parseFloat(form.discount || "0") || 0;
  const discountAmount = Math.min(r2(grossAmount * (discountPercent / 100)), grossAmount);
  const netAmount = r2(grossAmount - discountAmount);

  /** Reads as a figure only once one is known: blank with no customer picked,
   *  "Loading..." while it is fetched, and "-" when the read failed, so a
   *  stale or missing balance is never shown as a confident 0.00. */
  const dueText = !form.clientId
    ? ""
    : dueLoading
      ? "Loading..."
      : previousDue === null
        ? "-"
        : `${formatCurrency(Math.abs(previousDue))}${previousDue < 0 ? " (advance in hand)" : ""}`;

  const itemName = (itemId?: string) => availableItems.find((it) => it.id === itemId)?.itmName ?? itemId ?? "-";
  const customerName = (clientId?: string) => customers.find((c) => c.id === clientId)?.name ?? clientId ?? "-";

  const handleSave = async () => {
    if (!form.clientId) { toast.error("Select a customer"); return; }
    const valid = lines.filter((l) => l.itemId);
    if (!valid.length) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        advance: parseFloat(form.advance),
        discount: parseFloat(form.discount),
        totalPrice,
        items: valid.map((l) => ({ itemId: l.itemId, qty: parseFloat(l.qty), unitPrice: parseFloat(l.unitPrice) })),
      };
      if (editingId) {
        await updateOrder(editingId, payload);
        toast.success("Order updated");
      } else {
        await createOrder(payload);
        toast.success("Order created");
      }
      setModal(false); load();
    } catch (err) { toast.error(getErrorMessage(err, `Failed to ${editingId ? "update" : "create"} order`)); } finally { setSaving(false); }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ clientId: "", orderDate: new Date().toISOString().split("T")[0], deliveryDate: "", deliveryAddress: "", advance: "0", discount: "0" });
    setLines([{ itemId: "", qty: "1", unitPrice: "0" }]);
    setModal(true);
  };

  const openEdit = async (order: Order) => {
    try {
      const full = await fetchOrder(order.id);
      setEditingId(full.id);
      setForm({
        clientId: full.clientId ?? "",
        orderDate: full.orderDate ? full.orderDate.split("T")[0] : new Date().toISOString().split("T")[0],
        deliveryDate: full.deliveryDate ? full.deliveryDate.split("T")[0] : "",
        deliveryAddress: full.deliveryAddress ?? "",
        advance: String(full.advance ?? 0),
        discount: String(full.discount ?? 0),
      });
      setLines(
        full.details?.length
          ? full.details.map((d) => ({ itemId: d.itemId, qty: String(d.qty), unitPrice: String(d.unitPrice ?? 0) }))
          : [{ itemId: "", qty: "1", unitPrice: "0" }],
      );
      setModal(true);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load order")); }
  };

  const openReport = async (order: Order) => {
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      const full = await fetchOrder(order.id);
      setReport(full);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load order invoice"));
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handleDelete = async (order: Order) => {
    if (!confirm(`Delete order "${order.serialNo ?? order.id}"?`)) return;
    try {
      await deleteOrder(order.id);
      toast.success("Order deleted");
      load();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete order")); }
  };

  // Builds the receipt-style invoice payload from a loaded order — same shape
  // the POS terminal's printed invoice uses, minus paid/change which don't
  // apply to an order (advance/due stand in for those instead).
  const buildInvoiceData = (order: OrderRecord): OrderInvoiceData => {
    const branch = branches.find((b) => b.id === order.branchId);
    const grandTotal = order.totalPrice ?? 0;
    const discPercent = order.discount ?? 0;
    const items: OrderInvoiceLine[] = (order.details ?? []).map((d) => {
      const item = availableItems.find((it) => it.id === d.itemId);
      const itemVat = (d.qty * (d.unitPrice ?? 0)) * ((item?.vatPercentage ?? 0) / 100);
      return {
        itemName: itemName(d.itemId),
        qty: d.qty,
        rate: d.unitPrice ?? 0,
        vat: itemVat,
        total: d.qty * (d.unitPrice ?? 0),
      };
    });
    const vatAmount = r2(items.reduce((s, i) => s + i.vat, 0));
    // Discount applies to the VAT-inclusive gross — see the order form above.
    const gross = r2(grandTotal + vatAmount);
    const discAmount = Math.min(r2(gross * (discPercent / 100)), gross);
    const totalPayable = r2(gross - discAmount);
    const advance = order.advance ?? 0;
    return {
      branchName: branch?.branchName,
      branchAddress: branch?.address,
      branchVatNo: branch?.vatNo,
      branchMobile: branch?.mobileNo,
      orderDate: order.orderDate ?? new Date().toISOString(),
      serialNo: order.serialNo ?? String(order.id),
      customerName: customerName(order.clientId),
      servedBy: order.createBy,
      items,
      totalAmount: grandTotal,
      vatAmount,
      discountPercent: discPercent,
      discountAmount: discAmount,
      totalPayable,
      advance,
      totalDue: totalPayable - advance,
    };
  };

  const handlePreviewInvoice = () => { if (report) previewOrderInvoice(buildInvoiceData(report)); };
  const handlePrintInvoice = () => { if (report) printOrderInvoice(buildInvoiceData(report)); };
  const handleDownloadPdf = () => { if (report) exportOrderInvoicePdf(buildInvoiceData(report)).catch(() => toast.error("Failed to export PDF")); };
  const handleDownloadExcel = () => {
    if (!report) return;
    const inv = buildInvoiceData(report);
    const excelColumns: ExportColumn<OrderInvoiceLine>[] = [
      { header: "Item", value: (r) => r.itemName },
      { header: "Qty", value: (r) => r.qty, numeric: true },
      { header: "Rate", value: (r) => r.rate, numeric: true },
      { header: "VAT", value: (r) => r.vat, numeric: true },
      { header: "Total", value: (r) => r.total, numeric: true },
    ];
    exportExcel(inv.items, excelColumns, {
      title: "Order Invoice",
      subtitle: `Invoice: ${inv.serialNo} · Customer: ${inv.customerName} · ${formatDate(inv.orderDate)}`,
      footer: ["", "", "", "Total Due", formatCurrency(inv.totalDue)],
    }).catch(() => toast.error("Failed to export Excel"));
  };

  return (
    <AppLayout>
      <PageHeader title="Advance Order" action={canAdd ? { label: "New Order", onClick: openCreate, icon: <Plus size={16} /> } : undefined} />
      <Table loading={loading} data={orders}
        columns={[
          { key: "orderDate", header: "Order Date", render: (r) => formatDate(r.orderDate) },
          { key: "deliveryDate", header: "Delivery Date", render: (r) => formatDate(r.deliveryDate) },
          {
            key: "serialNo", header: "Order No",
            render: (r) => r.serialNo ? (
              <button onClick={() => openReport(r)} className="text-primary-800 hover:underline font-medium">
                {r.serialNo}
              </button>
            ) : "-",
          },
          { key: "clientId", header: "Customer", render: (r) => customerName(r.clientId) },
          { key: "totalPrice", header: "Total", render: (r) => `৳ ${formatCurrency(r.totalPrice ?? 0)}`, className: "text-right" },
          {
            key: "deliveryStatus", header: "Status",
            render: (r) => {
              const done = r.deliveryStatus === "Delivery Done";
              return (
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${done ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {r.deliveryStatus ?? "Delivery Pending"}
                </span>
              );
            },
          },
          {
            key: "actions", header: "",
            render: (r) => (
              <div className="flex items-center gap-3">
                {canEdit && (
                  <button onClick={() => openEdit(r)} className="text-primary-800 hover:underline" title="Edit">
                    <Edit2 size={14} />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600" title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
      <Modal open={modal} onClose={() => setModal(false)} title={editingId ? "Edit Order" : "New Order"} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <Select label="Customer *" value={form.clientId} onChange={(e) => {
              const clientId = e.target.value;
              const customer = customers.find((c) => c.id === clientId);
              setForm({ ...form, clientId, deliveryAddress: customer?.address ?? "" });
            }} placeholder="Select customer..." options={customers.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))} />
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
          <Input label="Order Date" type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
          <Input label="Delivery Date" type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
          <Input label="Delivery Address" value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} />
          <Input label="Advance" type="number" value={form.advance} onChange={(e) => setForm({ ...form, advance: e.target.value })} />
          <Input label="Discount (%)" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
          {/* What this customer already owes on everything raised before this
              order — read-only, and never posted with the order: it is their
              running ledger balance, not a figure of this document. Spanned by
              a wrapper, not `className`: on Input that prop lands on the
              control itself, so a col-span-* there never reaches the grid. */}
          <div className="col-span-2">
            <Input
              label="Last Due Balance (৳)"
              value={dueText}
              placeholder="Select a customer"
              disabled
              readOnly
            />
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <p className="text-sm font-medium text-gray-700">Order Items</p>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <Select
                  searchable
                  value={l.itemId}
                  onChange={(e) => updateLine(i, "itemId", e.target.value)}
                  placeholder="Select item..."
                  options={availableItems.map((it) => ({ value: it.id, label: `${it.itmCode} — ${it.itmName}` }))}
                />
              </div>
              <input type="number" placeholder="Qty" value={l.qty} onChange={(e) => updateLine(i, "qty", e.target.value)}
                className="w-20 border border-sage-400 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              <input type="number" placeholder="Price" value={l.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                className="w-24 border border-sage-400 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Item</Button>
        </div>
        <div className="flex justify-between items-end">
          <div className="text-sm space-y-0.5">
            <div>Grand Total: <span className="font-semibold">৳ {formatCurrency(totalPrice)}</span></div>
            {vatAmount > 0 && (
              <div>VAT Amount: <span className="font-semibold text-primary-700">+ ৳ {formatCurrency(vatAmount)}</span></div>
            )}
            {discountPercent > 0 && (
              <>
                <div>Total (incl. VAT): <span className="font-semibold">৳ {formatCurrency(grossAmount)}</span></div>
                <div>Discount ({discountPercent}%): <span className="font-semibold text-red-600">- ৳ {formatCurrency(discountAmount)}</span></div>
              </>
            )}
            <div className="font-semibold text-base">Net Amount: ৳ {formatCurrency(netAmount)}</div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editingId ? "Update Order" : "Save Order"}</Button>
          </div>
        </div>
      </Modal>

      {/* A walk-in registered from the order itself — the picker is refreshed
          and the new record selected, so the order carries on. */}
      <CustomerQuickAddModal
        open={customerModal}
        onClose={() => setCustomerModal(false)}
        onCreated={handleCustomerCreated}
      />

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Order Invoice" size="lg">
        {reportLoading || !report ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading...</div>
        ) : (
          (() => {
            const inv = buildInvoiceData(report);
            return (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-sm">
                  <div><span className="text-gray-500">Order No:</span> <span className="font-medium">{report.serialNo}</span></div>
                  <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{customerName(report.clientId)}</span></div>
                  <div><span className="text-gray-500">Order Date:</span> <span className="font-medium">{formatDate(report.orderDate)}</span></div>
                  <div><span className="text-gray-500">Delivery Date:</span> <span className="font-medium">{formatDate(report.deliveryDate)}</span></div>
                  <div><span className="text-gray-500">Delivery Address:</span> <span className="font-medium">{report.deliveryAddress || "-"}</span></div>
                  <div><span className="text-gray-500">Advance:</span> <span className="font-medium">৳ {formatCurrency(report.advance ?? 0)}</span></div>
                </div>
                <div className="mb-3 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={handlePreviewInvoice}><Eye size={14} /> Preview</Button>
                  <Button variant="secondary" size="sm" onClick={handlePrintInvoice}><Printer size={14} /> Print</Button>
                  <Button variant="secondary" size="sm" onClick={handleDownloadPdf}><FileText size={14} /> PDF</Button>
                  <Button variant="secondary" size="sm" onClick={handleDownloadExcel}><FileSpreadsheet size={14} /> Excel</Button>
                </div>
                <Table
                  data={inv.items.map((r, i) => ({ id: i, ...r }))}
                  columns={[
                    { key: "itemName", header: "Item" },
                    { key: "qty", header: "Qty", className: "text-right" },
                    { key: "rate", header: "Rate", className: "text-right", render: (r) => formatCurrency(r.rate) },
                    { key: "vat", header: "VAT", className: "text-right", render: (r) => formatCurrency(r.vat) },
                    { key: "total", header: "Total", className: "text-right", render: (r) => formatCurrency(r.total) },
                  ]}
                />
                <div className="mt-4 flex justify-end">
                  <div className="text-sm space-y-0.5 text-right">
                    <div>Total Amount: <span className="font-semibold">৳ {formatCurrency(inv.totalAmount)}</span></div>
                    <div>VAT Amount: <span className="font-semibold">৳ {formatCurrency(inv.vatAmount)}</span></div>
                    {inv.discountAmount > 0 && (
                      <div>Discount ({inv.discountPercent}%): <span className="font-semibold text-red-600">- ৳ {formatCurrency(inv.discountAmount)}</span></div>
                    )}
                    <div className="font-semibold">Total Payable: ৳ {formatCurrency(inv.totalPayable)}</div>
                    {inv.advance > 0 && <div>Advance: <span className="font-semibold">৳ {formatCurrency(inv.advance)}</span></div>}
                    <div className="font-semibold text-base text-red-600">Total Due: ৳ {formatCurrency(inv.totalDue)}</div>
                  </div>
                </div>
              </>
            );
          })()
        )}
      </Modal>
    </AppLayout>
  );
}
