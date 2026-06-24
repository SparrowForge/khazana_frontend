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
}

interface SaleItemsTableProps {
  items: SaleItem[];
  onItemsChange: (items: SaleItem[]) => void;
  availableItems: AvailableItem[];
}

export default function SaleItemsTable({
  items,
  onItemsChange,
  availableItems,
}: SaleItemsTableProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [qty, setQty] = useState("1");
  const [disc, setDisc] = useState("0");

  const addItem = () => {
    const itemMeta = availableItems.find(
      (item) => item.id === selectedItemId
    );

    if (!itemMeta) return;

    const rate = itemMeta.price ?? 0;
    const quantity = Number(qty) || 1;
    const discount = Number(disc) || 0;
    const total = rate * quantity - discount;

    onItemsChange([
      ...items,
      {
        itemId: itemMeta.id,
        itemCode: itemMeta.itmCode,
        itemName: itemMeta.itmName || "",
        quantity,
        rate,
        discount,
        vat: 0,
        total,
      },
    ]);

    setSelectedItemId("");
    setQty("1");
    setDisc("0");
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (
    index: number,
    field: keyof SaleItem,
    value: number
  ) => {
    const updatedItems = items.map((item, i) => {
      if (i !== index) return item;

      const updated = {
        ...item,
        [field]: value,
      };

      updated.total =
        Number(updated.rate) * Number(updated.quantity) -
        Number(updated.discount);

      return updated;
    });

    onItemsChange(updatedItems);
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + item.rate * item.quantity,
    0
  );

  const totalDiscount = items.reduce(
    (sum, item) => sum + item.discount,
    0
  );

  const netAmount = items.reduce(
    (sum, item) => sum + item.total,
    0
  );

  return (
    <div className="space-y-4">
      {/* Add Item Section */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="block mb-1 text-xs font-medium text-gray-600">
            Item
          </label>

          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
          >
            <option value="">Select item...</option>

            {availableItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itmCode} — {item.itmName}
              </option>
            ))}
          </select>
        </div>

        <div className="w-24">
          <label className="block mb-1 text-xs font-medium text-gray-600">
            Qty
          </label>

          <input
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
          />
        </div>

        <div className="w-28">
          <label className="block mb-1 text-xs font-medium text-gray-600">
            Discount
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={disc}
            onChange={(e) => setDisc(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800"
          />
        </div>

        <Button
          size="sm"
          onClick={addItem}
          disabled={!selectedItemId}
        >
          <Plus size={14} className="mr-1" />
          Add
        </Button>
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Discount</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-8 text-gray-400"
                >
                  No items added
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2">
                    {index + 1}
                  </td>

                  <td className="px-3 py-2">
                    {item.itemCode} — {item.itemName}
                  </td>

                  <td className="px-3 py-2 text-right">
                    {formatCurrency(item.rate)}
                  </td>

                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "quantity",
                          Number(e.target.value)
                        )
                      }
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-right"
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={item.discount}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "discount",
                          Number(e.target.value)
                        )
                      }
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-right"
                    />
                  </td>

                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(item.total)}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {items.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4}></td>

                <td className="px-3 py-2 text-right font-medium">
                  {formatCurrency(totalDiscount)}
                </td>

                <td className="px-3 py-2 text-right font-bold">
                  {formatCurrency(netAmount)}
                </td>

                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Summary */}
      <div className="text-right text-sm text-gray-600">
        <div>
          Gross:{" "}
          <span className="font-medium">
            {formatCurrency(totalAmount)}
          </span>
        </div>

        <div>
          Discount:{" "}
          <span className="font-medium">
            {formatCurrency(totalDiscount)}
          </span>
        </div>

        <div>
          Net:{" "}
          <span className="font-bold text-lg">
            {formatCurrency(netAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}