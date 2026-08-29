"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/api";
import { createItem, fetchNextItemCode, type Item } from "@/app/inventory/items/server";
import { fetchAllCategories, type Category } from "@/app/inventory/categories/server";
import { createPrice } from "@/app/prices/server";
import { useUomOptions } from "@/hooks/useUomOptions";

export const ITEM_TYPES = [
  { value: "RW",  label: "RW — Raw Material" },
  { value: "FG",  label: "FG — Finished Goods" },
  { value: "SFG", label: "SFG — Semi-Finished Goods" },
  { value: "P",   label: "P — Packaging" },
];

/** Far end of the open-ended price window the Price Setup page also defaults to. */
export const PRICE_OPEN_END = "2099-12-31";

const emptyForm = {
  itmCategory: "",
  itmCode: "",
  itmName: "",
  itmType: "FG",
  itmUOM: "Pcs",
  listPrice: "",
  vatPercent: "0",
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called once the item (and its opening price) is on file. */
  onCreated?: (item: Item) => void | Promise<void>;
}

/**
 * Adds an item to the catalogue without leaving the till.
 *
 * A sale screen can only offer what has a price — the POS product feed drops
 * any item with no active t_Price row, and a credit sale would bill it at 0 —
 * so this creates the price alongside the item rather than sending staff to
 * Pricing afterwards. The item is created first; if the price call then fails
 * the item still exists, which is why the failure says so instead of implying
 * nothing happened.
 */
export default function ItemQuickAddModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const uomOptions = useUomOptions();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    fetchAllCategories().then(setCategories).catch(() => {});
  }, [open]);

  /** Item Code is derived from the category's first letter, the same rule the
   *  Items page uses. Staff can still type over the suggestion. */
  const handleCategoryChange = (value: string) => {
    setForm((f) => ({ ...f, itmCategory: value }));
    if (!value) return;
    fetchNextItemCode(value)
      .then((itmCode) => setForm((f) => ({ ...f, itmCode })))
      .catch(() => {});
  };

  const handleSave = async () => {
    const price = parseFloat(form.listPrice);
    const vat = parseFloat(form.vatPercent || "0");
    if (!form.itmCode.trim()) { toast.error("Item code is required"); return; }
    if (!form.itmName.trim()) { toast.error("Item name is required"); return; }
    if (!form.itmType)        { toast.error("Item type is required"); return; }
    if (!form.itmUOM)         { toast.error("UOM is required"); return; }
    if (!Number.isFinite(price) || price <= 0) { toast.error("Enter a selling price"); return; }
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) { toast.error("VAT % must be between 0 and 100"); return; }

    setSaving(true);
    let created: Item | null = null;
    try {
      created = await createItem({
        itmCode:     form.itmCode.trim(),
        itmName:     form.itmName.trim(),
        itmCategory: form.itmCategory || undefined,
        itmType:     form.itmType,
        itmUOM:      form.itmUOM,
        isActive:    "Y",
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create item"));
      setSaving(false);
      return;
    }

    try {
      await createPrice({
        priceItemOId:   form.itmCode.trim(),
        priceFromDate:  new Date().toISOString().split("T")[0],
        priceToDate:    PRICE_OPEN_END,
        priceListPrice: price,
        priceVatPercent: vat,
        priceIsActive:  1,
      });
    } catch (err) {
      // The item is saved; only its price is missing, so say that rather than
      // let staff re-create the item and hit a duplicate-code error.
      toast.error(
        `${form.itmCode} was created but its price was not saved — set it in Pricing → Price Setup. (${getErrorMessage(err, "price failed")})`,
        { duration: 8000 },
      );
      setSaving(false);
      onClose();
      await onCreated?.(created);
      return;
    }

    toast.success(`${form.itmCode} added to the catalogue`);
    setSaving(false);
    onClose();
    await onCreated?.(created);
  };

  return (
    <Modal open={open} onClose={onClose} title="New Item">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Category"
          value={form.itmCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          options={[
            { value: "", label: "— Select Category —" },
            ...categories.map((c) => ({
              value: c.name ?? c.code,
              label: c.name ? `${c.code} - ${c.name}` : c.code,
            })),
          ]}
        />
        <Input
          label="Item Code *"
          value={form.itmCode}
          onChange={(e) => setForm({ ...form, itmCode: e.target.value })}
          placeholder="Select a category to auto-generate"
        />
        <Input
          label="Item Name *"
          value={form.itmName}
          onChange={(e) => setForm({ ...form, itmName: e.target.value })}
          placeholder="e.g. Kaju Barfi"
          className="col-span-2"
        />
        <Select
          label="Item Type *"
          value={form.itmType}
          onChange={(e) => setForm({ ...form, itmType: e.target.value })}
          options={ITEM_TYPES}
        />
        <Select
          label="UOM *"
          value={form.itmUOM}
          onChange={(e) => setForm({ ...form, itmUOM: e.target.value })}
          options={uomOptions}
        />
        <Input
          label="Selling Price *"
          type="number" min="0" step="0.01" inputMode="decimal"
          value={form.listPrice}
          onChange={(e) => setForm({ ...form, listPrice: e.target.value })}
          placeholder="0.00"
        />
        <Input
          label="VAT %"
          type="number" min="0" max="100" step="0.01" inputMode="decimal"
          value={form.vatPercent}
          onChange={(e) => setForm({ ...form, vatPercent: e.target.value })}
        />
        <p className="col-span-2 text-xs text-gray-500">
          The price starts today and runs open-ended; change it any time from
          <strong> Pricing → Price Setup</strong> or the Items list. A new item has no
          stock until it is received, so it can&apos;t be sold until then.
        </p>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Create Item</Button>
      </div>
    </Modal>
  );
}
