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
import { Plus, Edit2 } from "lucide-react";
import { fetchPrices, createPrice, updatePrice, fetchItems, type Price, type AvailableItem } from "./server";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

/**
 * MRP — what the customer actually pays: the list price plus its VAT, rounded
 * to 2dp, the same VAT-inclusive figure the invoices and reports print.
 *
 * Never stored. `t_Price` keeps the ex-VAT price and the rate it carries, and
 * this is recomputed from the pair wherever it is shown — so a price edited to
 * a new VAT rate can never leave a stale MRP behind. Returns null when either
 * side is missing, which the caller renders as a dash rather than ৳ 0.00.
 */
const vatInclusive = (
  listPrice: number | string | null | undefined,
  vatPercent: number | string | null | undefined,
): number | null => {
  const price = typeof listPrice === "number" ? listPrice : parseFloat(listPrice ?? "");
  const vat = typeof vatPercent === "number" ? vatPercent : parseFloat(vatPercent ?? "");
  if (!Number.isFinite(price) || !Number.isFinite(vat)) return null;
  return Math.round(price * (1 + vat / 100) * 100) / 100;
};

type FormState = { priceItemOId: string; priceFromDate: string; priceToDate: string; priceListPrice: string; priceVatPercent: string; priceIsActive: string; };
const emptyForm: FormState = { priceItemOId: "", priceFromDate: new Date().toISOString().split("T")[0], priceToDate: "2099-12-31", priceListPrice: "0", priceVatPercent: "0", priceIsActive: "1" };

export default function PricesPage() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [items, setItems] = useState<AvailableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Price | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { page, limit, meta, setMeta, setPage, setLimit, refreshKey } = usePagination();
  const { can } = usePermissions();
  const canAdd = can("Pricing", "add");
  const canEdit = can("Pricing", "edit");

  const load = () => {
    setLoading(true);
    fetchPrices({ page, limit })
      .then(({ items, meta }) => { setPrices(items); setMeta(meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, limit, refreshKey, setMeta]);
  useEffect(() => { fetchItems().then(setItems).catch(() => {}); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (p: Price) => {
    setEditing(p);
    setForm({ priceItemOId: p.priceItemOId ?? "", priceFromDate: p.priceFromDate?.split("T")[0] ?? "", priceToDate: p.priceToDate?.split("T")[0] ?? "", priceListPrice: String(p.priceListPrice ?? 0), priceVatPercent: String(p.priceVatPercent ?? 0), priceIsActive: String(p.priceIsActive ?? 1) });
    setModal(true);
  };

  const mrp = vatInclusive(form.priceListPrice, form.priceVatPercent);

  const handleSave = async () => {
    if (!form.priceItemOId) { toast.error("Select an item"); return; }
    setSaving(true);
    try {
      const payload = { ...form, priceListPrice: parseFloat(form.priceListPrice), priceVatPercent: parseFloat(form.priceVatPercent), priceIsActive: parseInt(form.priceIsActive) };
      if (editing) await updatePrice(editing.id, payload);
      else await createPrice(payload);
      toast.success(editing ? "Updated" : "Created");
      setModal(false); load();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save")); } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Price Setup" action={canAdd ? { label: "New Price", onClick: openCreate, icon: <Plus size={16} /> } : undefined} />
      <Table loading={loading} data={prices}
        columns={[
          { key: "item", header: "Item", render: (r) => `${r.item?.itmCode ?? ""} — ${r.item?.itmName ?? ""}` },
          { key: "priceFromDate", header: "From", render: (r) => formatDate(r.priceFromDate) },
          { key: "priceToDate", header: "To", render: (r) => formatDate(r.priceToDate) },
          { key: "priceListPrice", header: "Price", render: (r) => `৳ ${formatCurrency(r.priceListPrice ?? 0)}`, className: "text-right" },
          { key: "priceVatPercent", header: "VAT%", render: (r) => `${r.priceVatPercent ?? 0}%`, className: "text-right" },
          {
            key: "mrp",
            header: "MRP",
            render: (r) => {
              const value = vatInclusive(r.priceListPrice, r.priceVatPercent ?? 0);
              return value === null ? "-" : `৳ ${formatCurrency(value)}`;
            },
            className: "text-right",
          },
          { key: "priceIsActive", header: "Active" },
          { key: "actions", header: "", render: (r) => canEdit ? <button onClick={() => openEdit(r)} className="text-primary-600 hover:text-primary-800"><Edit2 size={14} /></button> : null },
        ]}
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} onLimitChange={setLimit} />}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Price" : "New Price"}>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Item *" value={form.priceItemOId} onChange={(e) => setForm({ ...form, priceItemOId: e.target.value })}
            placeholder="Select item..." options={items.map((i) => ({ value: i.id, label: `${i.itmCode} — ${i.itmName}` }))} className="col-span-2" />
          <Input label="From Date" type="date" value={form.priceFromDate} onChange={(e) => setForm({ ...form, priceFromDate: e.target.value })} />
          <Input label="To Date" type="date" value={form.priceToDate} onChange={(e) => setForm({ ...form, priceToDate: e.target.value })} />
          <Input label="List Price" type="number" value={form.priceListPrice} onChange={(e) => setForm({ ...form, priceListPrice: e.target.value })} />
          <Input label="VAT %" type="number" value={form.priceVatPercent} onChange={(e) => setForm({ ...form, priceVatPercent: e.target.value })} />
          {/* Derived, never posted — handleSave sends only the fields above.
              Wrapped because Input passes className to the control, not the
              grid item, so col-span-2 has to sit on a wrapper. */}
          <div className="col-span-2">
            <Input
              label="MRP (incl. VAT)"
              readOnly
              tabIndex={-1}
              value={mrp === null ? "-" : `৳ ${formatCurrency(mrp)}`}
              className="bg-sage-100 font-medium text-primary-900"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
