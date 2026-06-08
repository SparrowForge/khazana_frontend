"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Trash2 } from "lucide-react";
import { fetchOrders, createOrder, fetchCustomers, fetchItems, type Order, type Customer, type AvailableItem } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface OrderLine { itemCode: string; qty: string; unitPrice: string; }

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [lines, setLines] = useState<OrderLine[]>([{ itemCode: "", qty: "1", unitPrice: "0" }]);
  const [form, setForm] = useState({ clientCode: "", orderDate: new Date().toISOString().split("T")[0], deliveryDate: "", deliveryAddress: "", advance: "0", discount: "0" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchOrders().then(setOrders).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetchCustomers().then(setCustomers).catch(() => {});
    fetchItems().then(setAvailableItems).catch(() => {});
  }, []);

  const addLine = () => setLines([...lines, { itemCode: "", qty: "1", unitPrice: "0" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, f: keyof OrderLine, v: string) => setLines(lines.map((l, idx) => idx === i ? { ...l, [f]: v } : l));

  const totalPrice = lines.reduce((s, l) => s + parseFloat(l.qty || "0") * parseFloat(l.unitPrice || "0"), 0);

  const handleSave = async () => {
    if (!form.clientCode) { toast.error("Select a customer"); return; }
    const valid = lines.filter((l) => l.itemCode);
    if (!valid.length) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      await createOrder({
        ...form,
        advance: parseFloat(form.advance),
        discount: parseFloat(form.discount),
        totalPrice,
        items: valid.map((l) => ({ itemCode: l.itemCode, qty: parseFloat(l.qty), unitPrice: parseFloat(l.unitPrice) })),
      });
      toast.success("Order created");
      setModal(false); load();
    } catch { toast.error("Failed to create order"); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Orders" action={{ label: "New Order", onClick: () => { setLines([{ itemCode: "", qty: "1", unitPrice: "0" }]); setModal(true); }, icon: <Plus size={16} /> }} />
      <Table loading={loading} data={orders}
        columns={[
          { key: "serialNo", header: "Order No" },
          { key: "clientCode", header: "Customer" },
          { key: "orderDate", header: "Order Date", render: (r) => formatDate(r.orderDate) },
          { key: "deliveryDate", header: "Delivery Date", render: (r) => formatDate(r.deliveryDate) },
          { key: "totalPrice", header: "Total", render: (r) => `৳ ${formatCurrency(r.totalPrice ?? 0)}`, className: "text-right" },
        ]}
      />
      <Modal open={modal} onClose={() => setModal(false)} title="New Order" size="lg">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Select label="Customer *" value={form.clientCode} onChange={(e) => setForm({ ...form, clientCode: e.target.value })}
            placeholder="Select customer..." options={customers.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} />
          <Input label="Order Date" type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
          <Input label="Delivery Date" type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
          <Input label="Delivery Address" value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} />
          <Input label="Advance" type="number" value={form.advance} onChange={(e) => setForm({ ...form, advance: e.target.value })} />
          <Input label="Discount" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
        </div>
        <div className="space-y-2 mb-4">
          <p className="text-sm font-medium text-gray-700">Order Items</p>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={l.itemCode} onChange={(e) => updateLine(i, "itemCode", e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800">
                <option value="">Select item...</option>
                {availableItems.map((it) => <option key={it.id} value={it.itmCode}>{it.itmCode} — {it.itmName}</option>)}
              </select>
              <input type="number" placeholder="Qty" value={l.qty} onChange={(e) => updateLine(i, "qty", e.target.value)}
                className="w-20 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              <input type="number" placeholder="Price" value={l.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Item</Button>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Total: ৳ {formatCurrency(totalPrice)}</span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Order</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
