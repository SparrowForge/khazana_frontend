"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Edit2 } from "lucide-react";
import { fetchCostPrices, createCostPrice, updateCostPrice, fetchItems, type CostPrice, type AvailableItem } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

type FormState = { priceItemOId: string; priceFromDate: string; priceToDate: string; priceListPrice: string; };
const emptyForm: FormState = { priceItemOId: "", priceFromDate: new Date().toISOString().split("T")[0], priceToDate: "2099-12-31", priceListPrice: "0" };

export default function CostPricesPage() {
  const [prices, setPrices] = useState<CostPrice[]>([]);
  const [items, setItems] = useState<AvailableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CostPrice | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchCostPrices().then(setPrices).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); fetchItems().then(setItems).catch(() => {}); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (p: CostPrice) => {
    setEditing(p);
    setForm({ priceItemOId: p.priceItemOId ?? "", priceFromDate: p.priceFromDate?.split("T")[0] ?? "", priceToDate: p.priceToDate?.split("T")[0] ?? "", priceListPrice: String(p.priceListPrice ?? 0) });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.priceItemOId) { toast.error("Select an item"); return; }
    setSaving(true);
    try {
      const payload = { ...form, priceListPrice: parseFloat(form.priceListPrice) };
      if (editing) await updateCostPrice(editing.priceOId, payload);
      else await createCostPrice(payload);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Cost Price Setup" action={{ label: "New Cost Price", onClick: openCreate, icon: <Plus size={16} /> }} />
      <Table loading={loading} data={prices.map((p) => ({ ...p, id: p.priceOId }))}
        columns={[
          { key: "item", header: "Item", render: (r) => `${r.item?.itmCode ?? ""} — ${r.item?.itmName ?? ""}` },
          { key: "priceFromDate", header: "From", render: (r) => formatDate(r.priceFromDate) },
          { key: "priceToDate", header: "To", render: (r) => formatDate(r.priceToDate) },
          { key: "priceListPrice", header: "Cost Price", render: (r) => `৳ ${formatCurrency(r.priceListPrice ?? 0)}`, className: "text-right" },
          { key: "actions", header: "", render: (r) => <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button> },
        ]}
      />
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Cost Price" : "New Cost Price"}>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Item *" value={form.priceItemOId} onChange={(e) => setForm({ ...form, priceItemOId: e.target.value })}
            placeholder="Select item..." options={items.map((i) => ({ value: i.itmCode, label: `${i.itmCode} — ${i.itmName}` }))} className="col-span-2" />
          <Input label="From Date" type="date" value={form.priceFromDate} onChange={(e) => setForm({ ...form, priceFromDate: e.target.value })} />
          <Input label="To Date" type="date" value={form.priceToDate} onChange={(e) => setForm({ ...form, priceToDate: e.target.value })} />
          <Input label="Cost Price" type="number" value={form.priceListPrice} onChange={(e) => setForm({ ...form, priceListPrice: e.target.value })} className="col-span-2" />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
