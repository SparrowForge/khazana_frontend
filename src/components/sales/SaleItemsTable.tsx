"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { Trash2, Plus, Minus, Search } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { SaleItem } from "@/types";

interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
  vatPercentage?: number;
  /** On-hand qty from Inventory. Only consulted when `enforceStock` is set. */
  stock?: number;
  /** Unit of measure, shown under the price on the grid picker's cards. */
  itmUOM?: string | null;
  /** Joined MediaFile row — the card thumbnail on the grid picker. */
  image?: { fileUrl?: string | null } | null;
}

interface SaleItemsTableProps {
  items: SaleItem[];
  onItemsChange: (items: SaleItem[]) => void;
  availableItems: AvailableItem[];
  /** Show on-hand qty per item and refuse to bill more than is available. Off by
   *  default: this table is shared with forms that don't move stock (NC
   *  adjustment, assortment), which must keep working unchanged. */
  enforceStock?: boolean;
  /** Qty this document already holds, per itemId — for edit forms. The catalog's
   *  on-hand figure already has the saved version's deduction applied, so an
   *  amendment is judged against (on hand + what it took out), the same basis
   *  the server uses. Without it, reopening an invoice and saving it untouched
   *  would fail against its own stock movement. */
  heldStock?: Record<string, number>;
  /** Show the Total column VAT-inclusive. Display only — the line's stored
   *  `total` stays net of VAT, which is the shape every sale endpoint expects.
   *  On a credit sale the customer is billed the VAT-inclusive figure, so a
   *  column reading "Total" that excluded it invited the invoice to be checked
   *  against the wrong number. Off by default: the forms that price net of VAT
   *  (cash, VAT cash/credit, NC, assortment) keep reading as they did. */
  vatInclusiveTotal?: boolean;
  /** How items are picked. `"select"` (default) keeps the compact dropdown +
   *  Qty/Discount row every other sale form uses. `"grid"` swaps in the POS
   *  terminal's card grid — searchable, with the item's image, price, VAT rate
   *  and on-hand qty on the card, out-of-stock cards disabled — so a credit
   *  sale is rung up exactly the way the counter rings up a cash sale. */
  itemPicker?: "select" | "grid";
  /** Which half of the control to render. `"all"` (default) is picker above
   *  lines, as every sale form has always had it.
   *
   *  Splitting it lets a page put the picker and the billed lines in different
   *  columns — the POS terminal's shape, catalogue left / cart right. Render two
   *  instances sharing one `items` + `onItemsChange`: the parent owns the lines,
   *  so the halves stay in step, and the state each keeps to itself (the
   *  picker's search box, the lines' in-flight cell edit) belongs to that half
   *  anyway. */
  section?: "all" | "picker" | "lines";
  /** Render billed lines as the terminal's stacked cart rows instead of the wide
   *  8-column table. The table needs the full page width; a side column doesn't
   *  have it. */
  compactLines?: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Qty is decimal — show whole numbers without a trailing ".00". */
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(r2(n)));
/** One reusable toast slot: retyping a qty fires this on every keystroke, and a
 *  stable id replaces the previous message instead of stacking a column of them. */
const stockToast = (msg: string) => toast.error(msg, { id: "sale-items-stock" });

export default function SaleItemsTable({
  items,
  onItemsChange,
  availableItems,
  enforceStock = false,
  heldStock,
  vatInclusiveTotal = false,
  itemPicker = "select",
  section = "all",
  compactLines = false,
}: SaleItemsTableProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [qty, setQty] = useState("1");
  const [disc, setDisc] = useState("0");
  /** Grid picker's search box (name or item code). */
  const [search, setSearch] = useState("");
  /** In-flight text for the one table cell being typed in. Only ever a single
   *  cell has focus, so one slot is enough — and holding it here means a
   *  half-typed value ("1." / "") isn't parsed and written back on every
   *  keystroke, then committed (and validated) on blur or Enter. */
  const [draft, setDraft] = useState<{ idx: number; field: "quantity" | "discount"; value: string } | null>(null);

  /** What this form may still commit for an item: on-hand plus whatever the
   *  saved version of this document is holding. */
  const availableFor = (itemId: string) =>
    r2((availableItems.find((a) => a.id === itemId)?.stock ?? 0) + (heldStock?.[itemId] ?? 0));

  /** Qty already spoken for on this form for an item, so the same item split
   *  across two lines is measured against one balance. `exceptIdx` drops the
   *  line currently being edited from the tally. */
  const committedFor = (itemId: string, exceptIdx = -1) =>
    items.reduce((s, it, i) => (it.itemId === itemId && i !== exceptIdx ? s + it.quantity : s), 0);

  /** What is still pickable for an item: what the form may commit, less what
   *  its lines already hold. `Infinity` on forms that don't police stock, so the
   *  same card grid works there unchanged. */
  const remainingFor = (itemId: string) =>
    enforceStock ? r2(availableFor(itemId) - committedFor(itemId)) : Infinity;

  /** The line's VAT rate. Prefers the rate captured on the line, then the
   *  catalog; finally back-computes it from a saved line's vat/net so editing an
   *  existing invoice (whose lines carry an amount but no rate) keeps its VAT. */
  const vatPctFor = (item: SaleItem): number => {
    if (item.vatPercentage != null) return item.vatPercentage;
    const meta = availableItems.find((a) => a.id === item.itemId);
    if (meta?.vatPercentage != null) return meta.vatPercentage;
    const net = item.rate * item.quantity - item.discount;
    return net > 0 && item.vat > 0 ? (item.vat / net) * 100 : 0;
  };

  /** VAT is charged on the discounted (taxable) line value, and `total` stays
   *  net-of-VAT — the shape the sales/NC endpoints expect. */
  const recalc = (item: SaleItem): SaleItem => {
    const net = r2(item.rate * item.quantity - item.discount);
    const pct = vatPctFor(item);
    return { ...item, vatPercentage: pct, total: net, vat: r2((net * pct) / 100) };
  };

  const addItem = () => {
    const itemMeta = availableItems.find((i) => i.id === selectedItemId);
    if (!itemMeta) return;
    const quantity = parseFloat(qty) || 1;
    if (enforceStock) {
      const available = availableFor(itemMeta.id);
      if (r2(committedFor(itemMeta.id) + quantity) > available) {
        stockToast(
          `${itemMeta.itmName || itemMeta.itmCode} — only ${fmtQty(available)} in stock`,
        );
        return;
      }
    }
    onItemsChange([
      ...items,
      recalc({
        itemId: itemMeta.id,
        itemCode: itemMeta.itmCode,
        itemName: itemMeta.itmName,
        quantity,
        rate: itemMeta.price ?? 0,
        discount: parseFloat(disc) || 0,
        vatPercentage: itemMeta.vatPercentage ?? 0,
        vat: 0,
        total: 0,
      }),
    ]);
    setSelectedItemId("");
    setQty("1");
    setDisc("0");
  };

  /** Grid pick: tapping a card bills one more of that item — the POS terminal's
   *  behaviour. An item already on the invoice bumps its existing line rather
   *  than opening a second one, so the qty a card shows as left is the qty the
   *  invoice can still take.
   *
   *  Stock sold by weight rarely lands on a whole number: the last 0.5 kg of an
   *  item is real, sellable stock, so a card tap bills whatever is left when
   *  that is under one unit rather than refusing the line and stranding it. Only
   *  a genuinely empty balance is an error. */
  const addFromGrid = (itemMeta: AvailableItem) => {
    const name = itemMeta.itmName || itemMeta.itmCode;
    if ((itemMeta.price ?? 0) <= 0) {
      stockToast(`${name} — no active price, set one in Pricing → Price Setup`);
      return;
    }
    const remaining = remainingFor(itemMeta.id);
    if (enforceStock && remaining <= 0) {
      const available = availableFor(itemMeta.id);
      const onInvoice = committedFor(itemMeta.id);
      stockToast(
        available <= 0
          ? `${name} — out of stock`
          : onInvoice > 0
            ? `${name} — only ${fmtQty(available)} in stock, ${fmtQty(onInvoice)} already on this invoice`
            : `${name} — only ${fmtQty(available)} in stock`,
      );
      return;
    }
    // `remaining` is Infinity on forms that don't police stock, so this is 1
    // there — the behaviour those forms have always had.
    const add = Math.min(1, remaining);
    if (add < 1) {
      toast.success(`${name} — added the last ${fmtQty(add)}`, { id: "sale-items-stock" });
    }
    const idx = items.findIndex((it) => it.itemId === itemMeta.id);
    if (idx >= 0) {
      onItemsChange(
        items.map((it, i) => (i === idx ? recalc({ ...it, quantity: r2(it.quantity + add) }) : it)),
      );
      return;
    }
    onItemsChange([
      ...items,
      recalc({
        itemId: itemMeta.id,
        itemCode: itemMeta.itmCode,
        itemName: itemMeta.itmName,
        quantity: add,
        rate: itemMeta.price ?? 0,
        discount: 0,
        vatPercentage: itemMeta.vatPercentage ?? 0,
        vat: 0,
        total: 0,
      }),
    ]);
  };

  const removeItem = (idx: number) => {
    setDraft(null);
    onItemsChange(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof SaleItem, value: number) => {
    if (enforceStock && field === "quantity") {
      const { itemId } = items[idx];
      const available = availableFor(itemId);
      if (r2(committedFor(itemId, idx) + value) > available) {
        stockToast(`${items[idx].itemName || items[idx].itemCode} — only ${fmtQty(available)} in stock`);
        return;
      }
    }
    onItemsChange(items.map((item, i) => (i === idx ? recalc({ ...item, [field]: value }) : item)));
  };

  /** +/- stepper on a billed line, matching the terminal's cart controls.
   *
   *  Raising past a partial tail lands on the tail rather than being refused —
   *  the same rule the card grid follows, so "+" on a line holding 1 of an item
   *  with 1.5 on hand bills the 0.5 instead of nothing. */
  const stepQty = (idx: number, delta: number) => {
    setDraft(null);
    const { itemId, quantity } = items[idx];
    let next = r2(quantity + delta);
    if (next <= 0) return; // removing a line is an explicit action (the bin icon)
    if (enforceStock && delta > 0) {
      const ceiling = r2(availableFor(itemId) - committedFor(itemId, idx));
      if (next > ceiling && ceiling > quantity) next = ceiling;
    }
    updateItem(idx, "quantity", next);
  };

  /** Commit a typed cell. Anything that isn't a usable number reverts to the
   *  value the line already had rather than silently billing 0 (or a negative
   *  discount): a blank box is a half-finished edit, not an instruction. */
  const commitDraft = () => {
    if (!draft) return;
    const { idx, field, value } = draft;
    setDraft(null);
    const line = items[idx];
    if (!line) return;
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) return;
    if (field === "quantity") {
      if (parsed <= 0) {
        stockToast("Quantity must be greater than zero");
        return;
      }
      updateItem(idx, "quantity", r2(parsed));
      return;
    }
    if (parsed < 0) {
      stockToast("Discount can't be negative");
      return;
    }
    // A discount above the line's own value would invert the line (and, on a
    // credit sale, the invoice total the customer is billed).
    const lineGross = r2(line.rate * line.quantity);
    if (r2(parsed) > lineGross) {
      stockToast(
        `${line.itemName || line.itemCode} — discount can't exceed the line value (${formatCurrency(lineGross)})`,
      );
      return;
    }
    updateItem(idx, "discount", r2(parsed));
  };

  /** The text a cell shows: the in-flight draft while it's being typed, the
   *  committed number otherwise. */
  const cellValue = (idx: number, field: "quantity" | "discount") =>
    draft && draft.idx === idx && draft.field === field
      ? draft.value
      : String(items[idx][field]);

  /** Cards the grid shows — name or code match, catalogue order preserved. */
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableItems;
    return availableItems.filter(
      (i) =>
        (i.itmName ?? "").toLowerCase().includes(q) ||
        i.itmCode.toLowerCase().includes(q),
    );
  }, [availableItems, search]);

  const totalAmount = items.reduce((s, i) => s + i.rate * i.quantity, 0);
  const totalDiscount = items.reduce((s, i) => s + i.discount, 0);
  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const totalVat = items.reduce((s, i) => s + i.vat, 0);
  const grandTotal = netAmount + totalVat;
  /** What the Total column shows for one line, and its column footer. */
  const lineTotal = (item: SaleItem) => (vatInclusiveTotal ? r2(item.total + item.vat) : item.total);
  const columnTotal = vatInclusiveTotal ? grandTotal : netAmount;

  const gridPicker = (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-sage-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      {filteredCatalog.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          {availableItems.length ? "No item matches that search." : "No items with an active price found."}
        </div>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCatalog.map((p) => {
              const onHand = enforceStock ? availableFor(p.id) : 0;
              const left = remainingFor(p.id);
              const billed = committedFor(p.id);
              const soldOut = enforceStock && left <= 0;
              // No active price means the line would be billed at zero — the
              // POS terminal never lists such an item, so it isn't pickable here.
              const unpriced = (p.price ?? 0) <= 0;
              const blocked = soldOut || unpriced;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addFromGrid(p)}
                  disabled={blocked}
                  title={
                    unpriced
                      ? "No active price — set one in Pricing → Price Setup"
                      : soldOut
                        ? onHand <= 0
                          ? "Out of stock"
                          : "All available stock is already on this invoice"
                        : undefined
                  }
                  className={`relative bg-white border border-sage-300 rounded-xl p-4 text-left transition-all group ${
                    blocked
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-primary-500 hover:shadow-md active:scale-95"
                  }`}
                >
                  {billed > 0 && (
                    <span className="absolute top-2 right-2 z-10 bg-primary-600 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                      {fmtQty(billed)}
                    </span>
                  )}
                  <div className="w-full h-24 mb-2 rounded-lg overflow-hidden bg-sage-100 flex items-center justify-center">
                    {p.image?.fileUrl ? (
                      <Image
                        src={p.image.fileUrl}
                        alt={p.itmName || p.itmCode}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl">🍬</span>
                    )}
                  </div>
                  <p className="font-medium text-sm text-gray-800 leading-tight line-clamp-2 group-hover:text-primary-700">
                    {p.itmName || p.itmCode}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{p.itmCode}</p>
                  <p className={`font-bold text-sm mt-1.5 ${unpriced ? "text-red-500" : "text-primary-700"}`}>
                    {unpriced ? "No price set" : `৳${formatCurrency(p.price ?? 0)}`}
                    {!unpriced && p.itmUOM && (
                      <span className="text-gray-400 font-normal text-[10px] ml-1">/{p.itmUOM}</span>
                    )}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    {Number(p.vatPercentage) > 0 ? (
                      <span className="text-[10px] text-orange-500">+{p.vatPercentage}% VAT</span>
                    ) : <span />}
                    {enforceStock && (
                      <span
                        className={`text-[10px] font-medium ${soldOut ? "text-red-500" : "text-gray-400"}`}
                      >
                        {onHand <= 0
                          ? "Out of stock"
                          : soldOut
                            ? "All on invoice"
                            : `Stock: ${fmtQty(left)}`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const selectPicker = (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="text-xs font-medium text-gray-600 mb-1 block">Item</label>
        {/* Searchable: the catalogue runs to hundreds of items, and the picker
            is how a line gets added. Out-of-stock rows stay listed but
            unpickable, so it's clear why an item can't be billed. */}
        <Select
          searchable
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
          placeholder="Select item..."
          options={availableItems.map((i) => {
            const available = enforceStock ? availableFor(i.id) : 0;
            const suffix = enforceStock
              ? available > 0 ? ` (stock: ${fmtQty(available)})` : " (out of stock)"
              : "";
            return {
              value: i.id,
              label: `${i.itmCode} — ${i.itmName}${suffix}`,
              disabled: enforceStock && available <= 0,
            };
          })}
        />
      </div>
      <div className="w-24">
        <label className="text-xs font-medium text-gray-600 mb-1 block">Qty</label>
        <input
          type="number" min="0.01" step="0.01" inputMode="decimal"
          value={qty} onChange={(e) => setQty(e.target.value)}
          className="w-full border border-sage-400 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
        />
      </div>
      <div className="w-28">
        <label className="text-xs font-medium text-gray-600 mb-1 block">Discount</label>
        <input
          type="number" min="0" step="0.01"
          value={disc} onChange={(e) => setDisc(e.target.value)}
          className="w-full border border-sage-400 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
        />
      </div>
      <Button size="sm" onClick={addItem} disabled={!selectedItemId}>
        <Plus size={14} /> Add
      </Button>
  </div>
  );

  /** The terminal's cart row: name and bin on top, then rate × qty stepper,
   *  discount and the line total. Same handlers as the table — only the shape
   *  differs, so the two can't drift on validation. */
  const compactList = (
    <div className="rounded-lg border border-sage-300 bg-white overflow-hidden">
      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">No items added yet</div>
      ) : (
        <div className="divide-y divide-sage-200 max-h-[26rem] overflow-y-auto">
          {items.map((item, i) => (
            <div key={i} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 leading-tight">
                  <span className="text-gray-400 font-normal mr-1">{i + 1}.</span>
                  {item.itemName || item.itemCode}
                </p>
                <button
                  onClick={() => removeItem(i)}
                  title="Remove line"
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  ৳{formatCurrency(item.rate)}
                  {!!item.vatPercentage && (
                    <span className="text-orange-400 ml-1">+{item.vatPercentage}% VAT</span>
                  )}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => stepQty(i, -1)}
                      disabled={r2(item.quantity - 1) <= 0}
                      title="Decrease qty"
                      className="w-6 h-6 rounded-md bg-sage-200 hover:bg-sage-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number" min="0.01" step="0.01" inputMode="decimal"
                      value={cellValue(i, "quantity")}
                      onChange={(e) => setDraft({ idx: i, field: "quantity", value: e.target.value })}
                      onBlur={commitDraft}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label={`Quantity for ${item.itemName || item.itemCode}`}
                      className="w-14 text-center text-sm font-semibold border border-sage-300 rounded-md py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => stepQty(i, 1)}
                      disabled={enforceStock && remainingFor(item.itemId) <= 0}
                      title={
                        enforceStock && remainingFor(item.itemId) <= 0
                          ? "No more stock available"
                          : "Increase qty"
                      }
                      className="w-6 h-6 rounded-md bg-sage-200 hover:bg-sage-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <label className="flex items-center gap-1 text-[11px] text-gray-400">
                    Disc
                    <input
                      type="number" min="0" step="0.01"
                      value={cellValue(i, "discount")}
                      onChange={(e) => setDraft({ idx: i, field: "discount", value: e.target.value })}
                      onBlur={commitDraft}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label={`Discount for ${item.itemName || item.itemCode}`}
                      className="w-16 text-right border border-sage-300 rounded-md px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-800"
                    />
                  </label>
                  <span className="text-sm font-bold text-primary-700 whitespace-nowrap w-20 text-right">
                    ৳{formatCurrency(lineTotal(item))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const wideTable = (
      <div className="overflow-x-auto rounded-lg border border-sage-300">
        <table className="w-full text-sm">
          <thead className="bg-sage-100 border-b border-sage-300">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Item</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Rate</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Disc</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">VAT</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                {vatInclusiveTotal ? "Total (incl. VAT)" : "Total"}
              </th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sage-200">
            {items.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-gray-400">No items added</td></tr>
            )}
            {items.map((item, i) => (
              <tr key={i} className="hover:bg-sage-100">
                <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                <td className="px-3 py-2">{item.itemCode} — {item.itemName}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => stepQty(i, -1)}
                      disabled={r2(item.quantity - 1) <= 0}
                      title="Decrease qty"
                      className="p-1 rounded border border-sage-300 text-gray-500 hover:bg-sage-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus size={11} />
                    </button>
                    <input
                      type="number" min="0.01" step="0.01" inputMode="decimal"
                      value={cellValue(i, "quantity")}
                      onChange={(e) => setDraft({ idx: i, field: "quantity", value: e.target.value })}
                      onBlur={commitDraft}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      className="w-16 text-right border border-sage-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-800"
                    />
                    <button
                      type="button"
                      onClick={() => stepQty(i, 1)}
                      disabled={enforceStock && remainingFor(item.itemId) <= 0}
                      title={
                        enforceStock && remainingFor(item.itemId) <= 0
                          ? "No more stock available"
                          : "Increase qty"
                      }
                      className="p-1 rounded border border-sage-300 text-gray-500 hover:bg-sage-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number" min="0" step="0.01"
                    value={cellValue(i, "discount")}
                    onChange={(e) => setDraft({ idx: i, field: "discount", value: e.target.value })}
                    onBlur={commitDraft}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    className="w-20 text-right border border-sage-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-800"
                  />
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  {formatCurrency(item.vat)}
                  {!!item.vatPercentage && (
                    <span className="text-[10px] text-orange-500 ml-1">{item.vatPercentage}%</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(lineTotal(item))}</td>
                <td className="px-3 py-2">
                  <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-sage-100 border-t border-sage-300">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</td>
                <td className="px-3 py-2 text-right text-xs text-gray-700">{formatCurrency(totalDiscount)}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-700">{formatCurrency(totalVat)}</td>
                <td className="px-3 py-2 text-right font-bold text-gray-800">{formatCurrency(columnTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
  );

  /** Running totals under the lines. Stacked when compact — the one-line strip
   *  wraps into an unreadable knot in a side column. */
  const totalsStrip = compactLines ? (
    <dl className="rounded-lg border border-sage-300 bg-sage-100 px-3 py-2 text-sm">
      {([
        ["Gross", totalAmount],
        ["Discount", totalDiscount],
        ["Net", netAmount],
        ["VAT", totalVat],
      ] as const).map(([label, value]) => (
        <div key={label} className="flex justify-between text-gray-500">
          <dt>{label}</dt>
          <dd className="font-medium text-gray-700">{formatCurrency(value)}</dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-sage-300 mt-1.5 pt-1.5">
        <dt className="font-semibold text-gray-700">Total</dt>
        <dd className="font-bold text-gray-800">{formatCurrency(grandTotal)}</dd>
      </div>
    </dl>
  ) : (
    <div className="text-right text-sm text-gray-500">
      Gross: <span className="font-medium">{formatCurrency(totalAmount)}</span>
      {" | "}Discount: <span className="font-medium">{formatCurrency(totalDiscount)}</span>
      {" | "}Net: <span className="font-medium">{formatCurrency(netAmount)}</span>
      {" | "}VAT: <span className="font-medium">{formatCurrency(totalVat)}</span>
      {" | "}Total: <span className="font-bold text-gray-800 text-base">{formatCurrency(grandTotal)}</span>
    </div>
  );

  if (section === "picker") {
    return itemPicker === "grid" ? gridPicker : selectPicker;
  }

  const lines = (
    <div className="space-y-3">
      {compactLines ? compactList : wideTable}
      {totalsStrip}
    </div>
  );

  if (section === "lines") return lines;

  return (
    <div className="space-y-3">
      {itemPicker === "grid" ? gridPicker : selectPicker}
      {lines}
    </div>
  );
}
