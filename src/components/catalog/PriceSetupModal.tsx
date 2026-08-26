"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createPrice, fetchCurrentPrice, type Price } from "@/app/prices/server";
import { PRICE_OPEN_END } from "./ItemQuickAddModal";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The item being priced — `itmCode` is what t_Price keys on. */
  item: { itmCode: string; itmName?: string } | null;
  onSaved?: () => void | Promise<void>;
}

const today = () => new Date().toISOString().split("T")[0];

/**
 * Sets an item's selling price from wherever the item is listed, so pricing a
 * new item doesn't mean walking over to the Pricing page and finding it again.
 *
 * Saving posts a *new* price row: the backend deactivates the item's previous
 * active price and the new one takes over, which keeps the old rate on file for
 * invoices already raised against it. The rate showing at the top is whatever
 * is active today, so the dialog opens on the current price rather than blank.
 */
export default function PriceSetupModal({ open, onClose, item, onSaved }: Props) {
  const [current, setCurrent] = useState<Price | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    priceFromDate: today(),
    priceToDate: PRICE_OPEN_END,
    priceListPrice: "",
    priceVatPercent: "0",
  });

  useEffect(() => {
    if (!open || !item) return;
    let stale = false;
    setCurrent(null);
    setForm({ priceFromDate: today(), priceToDate: PRICE_OPEN_END, priceListPrice: "", priceVatPercent: "0" });
    setLoading(true);
    fetchCurrentPrice(item.itmCode)
      .then((price) => {
        if (stale) return;
        setCurrent(price);
        if (!price) return;
        // Prefill with today's rate — most edits are a change to the amount,
        // not a re-keying of the whole window.
        setForm({
          priceFromDate: today(),
          priceToDate: price.priceToDate?.split("T")[0] || PRICE_OPEN_END,
          priceListPrice: String(price.priceListPrice ?? ""),
          priceVatPercent: String(price.priceVatPercent ?? 0),
        });
      })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [open, item]);

  const handleSave = async () => {
    if (!item) return;
    const price = parseFloat(form.priceListPrice);
    const vat = parseFloat(form.priceVatPercent || "0");
    if (!Number.isFinite(price) || price <= 0) { toast.error("Enter a selling price"); return; }
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) { toast.error("VAT % must be between 0 and 100"); return; }
    if (!form.priceFromDate) { toast.error("From date is required"); return; }
    if (form.priceToDate && form.priceToDate < form.priceFromDate) {
      toast.error("To date can't be before the From date");
      return;
    }
    setSaving(true);
    try {
      await createPrice({
        priceItemOId:    item.itmCode,
        priceFromDate:   form.priceFromDate,
        priceToDate:     form.priceToDate || PRICE_OPEN_END,
        priceListPrice:  price,
        priceVatPercent: vat,
        priceIsActive:   1,
      });
      toast.success(`Price set for ${item.itmCode}`);
      onClose();
      await onSaved?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save price"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Price Setup">
      <div className="mb-4 rounded-md border border-sage-300 bg-white px-3 py-2 text-sm">
        <span className="font-medium text-gray-800">{item?.itmCode}</span>
        {item?.itmName && <span className="text-gray-500"> — {item.itmName}</span>}
        <div className="text-xs text-gray-500 mt-1">
          {loading ? (
            "Loading current price…"
          ) : current ? (
            <>
              Current: <span className="font-medium text-gray-700">৳ {formatCurrency(current.priceListPrice ?? 0)}</span>
              {" "}+ {current.priceVatPercent ?? 0}% VAT
              {current.priceFromDate && <> · from {formatDate(current.priceFromDate)}</>}
              {current.priceToDate && <> to {formatDate(current.priceToDate)}</>}
            </>
          ) : (
            <span className="text-amber-600">No active price — this item can&apos;t be sold until one is set.</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="From Date *" type="date" value={form.priceFromDate}
          onChange={(e) => setForm({ ...form, priceFromDate: e.target.value })} />
        <Input label="To Date" type="date" value={form.priceToDate}
          onChange={(e) => setForm({ ...form, priceToDate: e.target.value })} />
        <Input label="List Price *" type="number" min="0" step="0.01" inputMode="decimal"
          value={form.priceListPrice} placeholder="0.00"
          onChange={(e) => setForm({ ...form, priceListPrice: e.target.value })} />
        <Input label="VAT %" type="number" min="0" max="100" step="0.01" inputMode="decimal"
          value={form.priceVatPercent}
          onChange={(e) => setForm({ ...form, priceVatPercent: e.target.value })} />
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Saving records a new price and retires the current one — invoices already
        raised keep the rate they were billed at.
      </p>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Save Price</Button>
      </div>
    </Modal>
  );
}
