"use client";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Trash2 } from "lucide-react";
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

interface Line { itemId: string; qty: string; rate: string }

interface Props {
  open: boolean;
  onClose: () => void;
  items: ProducibleItem[];
  /** Lines to pre-seed — the invoice's shortfalls, so the dialog opens on
   *  exactly what is missing rather than an empty sheet. */
  suggested?: { itemId: string; qty: number }[];
  /** Fired after a successful save so the caller can re-pull on-hand stock. */
  onCreated?: () => void | Promise<void>;
}

const blankLine = (): Line => ({ itemId: "", qty: "", rate: "" });

/**
 * Books production without leaving the invoice.
 *
 * Production ADDS stock, and a credit sale can't be billed for more than is on
 * hand — so an invoice for goods that were made but never entered is stuck at
 * the save button. This is the way out of that, for the factory session only.
 *
 * The rate here is the VAT-INCLUSIVE unit price (the same convention the
 * Production Entry page records), seeded from the item's list price grossed up
 * by its VAT rate and editable — a production rate is a costing decision, not
 * the sale price. The branch is never asked for: the backend books it against
 * the session's branch.
 */
export default function ProductionQuickEntryModal({ open, onClose, items, suggested, onCreated }: Props) {
  const branchName = useAuthStore((s) => s.user?.branchName) ?? "Factory";
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  useEffect(() => {
    if (!open) return;
    setProductionDate(new Date().toISOString().split("T")[0]);
    setRemarks("");
    const seeded = (suggested ?? [])
      .filter((s) => itemById.has(s.itemId))
      .map<Line>((s) => ({
        itemId: s.itemId,
        qty: String(s.qty),
        rate: String(vatInclusiveRate(itemById.get(s.itemId))),
      }));
    setLines(seeded.length ? seeded : [blankLine()]);
    // `suggested` is rebuilt on every render of the caller, so it is read on
    // open rather than tracked — reseeding mid-edit would wipe typed input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  /** Picking an item seeds its rate, unless one has already been typed. */
  const pickItem = (i: number, itemId: string) =>
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const seededRate = String(vatInclusiveRate(itemById.get(itemId)));
        const untouched = !l.rate || l.rate === String(vatInclusiveRate(itemById.get(l.itemId)));
        return { ...l, itemId, rate: untouched ? seededRate : l.rate };
      }),
    );

  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? [blankLine()] : prev.filter((_, idx) => idx !== i)));

  const validLines = lines
    .map((l) => ({
      itemId: l.itemId,
      qty: parseFloat(l.qty) || 0,
      rate: parseFloat(l.rate) || vatInclusiveRate(itemById.get(l.itemId)),
    }))
    .filter((l) => l.itemId && l.qty > 0);

  const total = validLines.reduce((s, l) => s + l.qty * l.rate, 0);

  const handleSave = async () => {
    if (!validLines.length) { toast.error("Add at least one item with a quantity"); return; }
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

  const itemOptions = items.map((i) => ({
    value: i.id,
    label: `${i.itmCode} — ${i.itmName ?? ""}`,
  }));

  return (
    <Modal open={open} onClose={onClose} title="Production Entry" size="lg">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Input label="Production Date *" type="date" value={productionDate}
          onChange={(e) => setProductionDate(e.target.value)} />
        <Input label="Branch" value={branchName} disabled readOnly />
        <Input label="Remarks" value={remarks} maxLength={500}
          onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Items Produced</p>
          <span className="text-xs text-gray-400">Rate is VAT-inclusive</span>
        </div>

        {lines.map((line, i) => {
          const item = itemById.get(line.itemId);
          return (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 min-w-0">
                <Select
                  searchable
                  value={line.itemId}
                  onChange={(e) => pickItem(i, e.target.value)}
                  placeholder="Select item..."
                  options={itemOptions}
                />
                {item && (
                  <p className="text-[11px] text-gray-400 mt-0.5 pl-0.5">
                    On hand: {item.stock ?? 0}
                  </p>
                )}
              </div>
              <input
                type="number" min="0" step="0.01" placeholder="Qty"
                value={line.qty}
                onChange={(e) => setLine(i, { qty: e.target.value })}
                className="w-24 border border-sage-400 rounded-md px-2 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
              />
              <input
                type="number" min="0" step="0.01" placeholder="Rate"
                value={line.rate}
                onChange={(e) => setLine(i, { rate: e.target.value })}
                className="w-28 border border-sage-400 rounded-md px-2 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-800"
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                title="Remove line"
                className="text-red-400 hover:text-red-600 pt-2.5"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        <Button variant="secondary" size="sm" onClick={() => setLines((prev) => [...prev, blankLine()])}>
          <Plus size={14} /> Add Item
        </Button>
      </div>

      <div className="flex items-center justify-between border-t border-sage-300 mt-4 pt-3 text-sm">
        <span className="text-gray-500">
          {validLines.length} item{validLines.length === 1 ? "" : "s"} to produce
        </span>
        <span className="font-semibold text-gray-800">Total: ৳ {formatCurrency(total)}</span>
      </div>

      <div className="flex justify-end gap-3 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Save Production</Button>
      </div>
    </Modal>
  );
}
