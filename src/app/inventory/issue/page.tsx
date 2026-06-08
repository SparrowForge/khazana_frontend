"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { fetchItems, issueStock, type AvailableItem } from "./server";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";

interface IssueLine { itemCode: string; qty: string; unitPrice: string; }

export default function StockIssuePage() {
  const [voucherNo, setVoucherNo] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<IssueLine[]>([{ itemCode: "", qty: "1", unitPrice: "0" }]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
  }, []);

  const addLine = () => setLines([...lines, { itemCode: "", qty: "1", unitPrice: "0" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof IssueLine, val: string) =>
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const handleSubmit = async () => {
    const valid = lines.filter((l) => l.itemCode && parseFloat(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one valid line"); return; }
    setSubmitting(true);
    try {
      await issueStock({
        voucherNo, issueDate,
        items: valid.map((l) => ({ itemCode: l.itemCode, qty: parseFloat(l.qty), unitPrice: parseFloat(l.unitPrice) })),
      });
      toast.success("Stock issue saved");
      setLines([{ itemCode: "", qty: "1", unitPrice: "0" }]);
      setVoucherNo("");
    } catch { toast.error("Failed to save"); } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Stock Issue" subtitle="Record outgoing stock" />
      <Card title="Issue Details">
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Input label="Voucher No" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
          <Input label="Date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Select
                label={i === 0 ? "Item" : undefined}
                value={line.itemCode}
                onChange={(e) => updateLine(i, "itemCode", e.target.value)}
                placeholder="Select item..."
                options={availableItems.map((it) => ({ value: it.itmCode, label: `${it.itmCode} — ${it.itmName}` }))}
                className="flex-1"
              />
              <div className="w-24">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block">Qty</label>}
                <input type="number" min="0.01" step="0.01" value={line.qty} onChange={(e) => updateLine(i, "qty", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              </div>
              <div className="w-28">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block">Unit Price</label>}
                <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              </div>
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 pb-2"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={handleSubmit} loading={submitting}>Save Stock Issue</Button>
        </div>
      </Card>
    </AppLayout>
  );
}
