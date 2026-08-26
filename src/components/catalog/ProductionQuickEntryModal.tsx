"use client";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { createProduction, vatInclusiveRate } from "@/app/inventory/production/server";

/** Catalogue shape this needs — structural, so the sale forms' own
 *  `AvailableItem` types satisfy it without converting. */
export interface ProducibleItem {
  id: string;
  itmCode: string;
  itmName?: string;
  /** VAT-EXCLUSIVE list price; the production rate is grossed up from it. */
  price?: number;
  vatPercentage?: number;
  stock?: number;
}

/** What the user typed against one item. Absent = untouched, same as qty 0. */
interface ItemEntry { qty: string; rate: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  items: ProducibleItem[];
  /** Quantities to pre-fill — the invoice's shortfalls, so the sheet opens with
   *  what is missing already typed in, on top of the full catalogue. */
  suggested?: { itemId: string; qty: number }[];
  /** Fired after a successful save so the caller can re-pull on-hand stock. */
  onCreated?: () => void | Promise<void>;
}

const entryAmount = (e: ItemEntry) => (parseFloat(e.qty) || 0) * (parseFloat(e.rate) || 0);

/**
 * Books production without leaving the invoice.
 *
 * Production ADDS stock, and a credit sale can't be billed for more than is on
 * hand — so an invoice for goods that were made but never entered is stuck at
 * the save button. This is the way out of that, for the factory session only.
 *
 * The sheet is the same one the Production Entry page uses: the whole catalogue
 * listed with the quantity typed inline, and only rows carrying a qty are sent.
 * The invoice's shortfalls arrive pre-filled, so the common case is still one
 * glance and save — but anything else made that day can be booked alongside it.
 *
 * The rate is the VAT-INCLUSIVE unit price (the same convention the Production
 * Entry page records), seeded from the item's list price grossed up by its VAT
 * rate and editable — a production rate is a costing decision, not the sale
 * price. The branch is never asked for: the backend books it against the
 * session's branch.
 */
export default function ProductionQuickEntryModal({ open, onClose, items, suggested, onCreated }: Props) {
  const branchName = useAuthStore((s) => s.user?.branchName) ?? "Factory";
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  useEffect(() => {
    if (!open) return;
    setProductionDate(new Date().toISOString().split("T")[0]);
    setRemarks("");
    setItemSearch("");
    setEntries(
      (suggested ?? []).reduce<Record<string, ItemEntry>>((acc, s) => {
        const item = itemById.get(s.itemId);
        if (item) acc[s.itemId] = { qty: String(s.qty), rate: String(vatInclusiveRate(item)) };
        return acc;
      }, {}),
    );
    // `suggested` is rebuilt on every render of the caller, so it is read on
    // open rather than tracked — reseeding mid-edit would wipe typed input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** An untouched row still shows the item's own VAT-inclusive price, so the
   *  grid reads as a rate sheet the user only has to type quantities into. */
  const entryFor = (it: ProducibleItem): ItemEntry =>
    entries[it.id] ?? { qty: "", rate: String(vatInclusiveRate(it)) };

  const setEntry = (it: ProducibleItem, patch: Partial<ItemEntry>) =>
    setEntries((prev) => ({ ...prev, [it.id]: { ...entryFor(it), ...patch } }));

  /** The lines that will actually be saved: qty > 0, in catalogue order. */
  const validLines = useMemo(
    () =>
      items
        .filter((it) => parseFloat(entries[it.id]?.qty ?? "") > 0)
        .map((it) => {
          const entry = entries[it.id];
          return {
            itemId: it.id,
            qty: parseFloat(entry.qty),
            // A row the user never edited the rate on falls back to the item's
            // own price rather than saving a zero-value production line.
            rate: parseFloat(entry.rate || "") || vatInclusiveRate(it),
          };
        }),
    [items, entries],
  );

  const total = validLines.reduce((s, l) => s + l.qty * l.rate, 0);

  /** The grid shows every item; a catalogue of any size needs a filter. Rows
   *  already carrying a qty stay visible so a search can't hide pending input
   *  — including the shortfalls the invoice seeded. */
  const visibleItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        parseFloat(entries[it.id]?.qty ?? "") > 0 ||
        it.itmCode?.toLowerCase().includes(q) ||
        it.itmName?.toLowerCase().includes(q),
    );
  }, [items, entries, itemSearch]);

  const handleSave = async () => {
    if (!validLines.length) { toast.error("Enter a quantity on at least one item"); return; }
    if (!productionDate) { toast.error("Production date is required"); return; }
    const zeroRate = validLines.find((l) => l.rate <= 0);
    if (zeroRate) {
      toast.error(`${itemById.get(zeroRate.itemId)?.itmCode ?? "An item"} has no rate — set one to book it`);
      return;
    }
    setSaving(true);
    try {
      await createProduction({
        productionDate,
        remarks: remarks.trim() || undefined,
        items: validLines,
      });
      toast.success(`Production booked for ${validLines.length} item(s)`);
      onClose();
      await onCreated?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save production entry"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Production Entry" size="lg">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Input label="Production Date *" type="date" value={productionDate}
          onChange={(e) => setProductionDate(e.target.value)} />
        <Input label="Branch" value={branchName} disabled readOnly />
        <Input label="Remarks" value={remarks} maxLength={500}
          onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
      </div>

      <div className="flex items-center justify-between gap-3 mb-2">
        <Input
          placeholder="Search items by code or name..."
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          className="w-72"
        />
        <div className="text-sm text-gray-500">
          {validLines.length} item{validLines.length === 1 ? "" : "s"} to produce
          <span className="text-xs text-gray-400 ml-2">Rate is VAT-inclusive</span>
        </div>
      </div>

      {/* The whole catalogue, with the quantity typed inline — the same sheet
          the Production Entry page uses. Scrolls rather than paginates so a
          part-filled sheet is never split across pages. Only rows carrying a
          quantity are saved. */}
      <div className="border border-sage-300 rounded-lg overflow-auto max-h-[45vh]">
        <table className="w-full text-sm">
          <thead className="bg-sage-100 sticky top-0 z-10">
            <tr className="text-left text-gray-600">
              <th className="px-3 py-2 font-medium">Item ID</th>
              <th className="px-3 py-2 font-medium">Item Name</th>
              <th className="px-3 py-2 font-medium text-right">Current Stock</th>
              <th className="px-3 py-2 font-medium text-right w-28">Qty</th>
              <th className="px-3 py-2 font-medium text-right w-32">Rate (incl. VAT)</th>
              <th className="px-3 py-2 font-medium text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((it) => {
              const entry = entryFor(it);
              const qty = parseFloat(entry.qty) || 0;
              return (
                <tr key={it.id} className={`border-t border-sage-200 ${qty > 0 ? "bg-primary-50/40" : ""}`}>
                  <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{it.itmCode}</td>
                  <td className="px-3 py-1.5">{it.itmName}</td>
                  {/* Context only — production adds stock, so nothing to cap. */}
                  <td className="px-3 py-1.5 text-right text-gray-500">{it.stock ?? 0}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.qty}
                      placeholder="0"
                      onChange={(e) => setEntry(it, { qty: e.target.value })}
                      className="w-full border border-sage-400 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.rate}
                      onChange={(e) => setEntry(it, { rate: e.target.value })}
                      className="w-full border border-sage-400 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-700 whitespace-nowrap">
                    {formatCurrency(entryAmount(entry))}
                  </td>
                </tr>
              );
            })}
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  No items match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end text-sm font-medium text-gray-700">
        Total (incl. VAT): <span className="ml-2 w-28 text-right">{formatCurrency(total)}</span>
      </div>

      <div className="flex justify-end gap-3 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!validLines.length}>Save Production</Button>
      </div>
    </Modal>
  );
}
