"use client";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { SaleItem } from "@/types";

interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
  vatPercentage?: number;
}

interface SaleItemsTableProps {
  items: SaleItem[];
  onItemsChange: (items: SaleItem[]) => void;
  availableItems: AvailableItem[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function SaleItemsTable({ items, onItemsChange, availableItems }: SaleItemsTableProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [qty, setQty] = useState("1");
  const [disc, setDisc] = useState("0");

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
    onItemsChange([
      ...items,
      recalc({
        itemId: itemMeta.id,
        itemCode: itemMeta.itmCode,
        itemName: itemMeta.itmName,
        quantity: parseFloat(qty) || 1,
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

  const removeItem = (idx: number) => {
    onItemsChange(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof SaleItem, value: number) => {
    onItemsChange(items.map((item, i) => (i === idx ? recalc({ ...item, [field]: value }) : item)));
  };

  const totalAmount = items.reduce((s, i) => s + i.rate * i.quantity, 0);
  const totalDiscount = items.reduce((s, i) => s + i.discount, 0);
  const netAmount = items.reduce((s, i) => s + i.total, 0);
  const totalVat = items.reduce((s, i) => s + i.vat, 0);
  const grandTotal = netAmount + totalVat;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Item</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
          >
            <option value="">Select item...</option>
            {availableItems.map((i) => (
              <option key={i.id} value={i.id}>{i.itmCode} — {i.itmName}</option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Qty</label>
          <input
            type="number" min="0.01" step="0.01" inputMode="decimal"
            value={qty} onChange={(e) => setQty(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
          />
        </div>
        <div className="w-28">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Discount</label>
          <input
            type="number" min="0" step="0.01"
            value={disc} onChange={(e) => setDisc(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
          />
        </div>
        <Button size="sm" onClick={addItem} disabled={!selectedItemId}>
          <Plus size={14} /> Add
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Item</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Rate</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Disc</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">VAT</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-gray-400">No items added</td></tr>
            )}
            {items.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                <td className="px-3 py-2">{item.itemCode} — {item.itemName}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number" min="0.01" step="0.01" inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                    className="w-20 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-800"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number" min="0" step="0.01"
                    value={item.discount}
                    onChange={(e) => updateItem(i, "discount", parseFloat(e.target.value) || 0)}
                    className="w-20 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-800"
                  />
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  {formatCurrency(item.vat)}
                  {!!item.vatPercentage && (
                    <span className="text-[10px] text-orange-500 ml-1">{item.vatPercentage}%</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                <td className="px-3 py-2">
                  <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</td>
                <td className="px-3 py-2 text-right text-xs text-gray-700">{formatCurrency(totalDiscount)}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-700">{formatCurrency(totalVat)}</td>
                <td className="px-3 py-2 text-right font-bold text-gray-800">{formatCurrency(netAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="text-right text-sm text-gray-500">
        Gross: <span className="font-medium">{formatCurrency(totalAmount)}</span>
        {" | "}Discount: <span className="font-medium">{formatCurrency(totalDiscount)}</span>
        {" | "}Net: <span className="font-medium">{formatCurrency(netAmount)}</span>
        {" | "}VAT: <span className="font-medium">{formatCurrency(totalVat)}</span>
        {" | "}Total: <span className="font-bold text-gray-800 text-base">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}
