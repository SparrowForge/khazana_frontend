"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { fetchItems, adjustStock, type AvailableItem } from "./server";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";

interface AdjLine { itmOId: string; reject: string; excess: string; short: string; assort: string; }

export default function StockAdjustmentPage() {
  const [invNo, setInvNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<AdjLine[]>([{ itmOId: "", reject: "0", excess: "0", short: "0", assort: "0" }]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems().then(setAvailableItems).catch(() => {});
  }, []);

  const addLine = () => setLines([...lines, { itmOId: "", reject: "0", excess: "0", short: "0", assort: "0" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof AdjLine, val: string) =>
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const handleSubmit = async () => {
    const valid = lines.filter((l) => l.itmOId);
    if (!valid.length) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      await adjustStock({
        invNo, date,
        items: valid.map((l) => ({
          itmOId: l.itmOId,
          reject: parseFloat(l.reject),
          excess: parseFloat(l.excess),
          short: parseFloat(l.short),
          assort: parseFloat(l.assort),
        })),
      });
      toast.success("Adjustment saved");
      setLines([{ itmOId: "", reject: "0", excess: "0", short: "0", assort: "0" }]);
      setInvNo("");
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save")); } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Stock Adjustment" subtitle="Record reject, excess, short, assort adjustments" />
      <Card title="Adjustment Details">
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Input label="Reference No" value={invNo} onChange={(e) => setInvNo(e.target.value)} />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-6 gap-2 text-xs font-semibold text-gray-600 px-1">
            <span className="col-span-2">Item</span><span>Reject</span><span>Excess</span><span>Short</span><span>Assort</span>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 items-center">
              <select value={line.itmOId} onChange={(e) => updateLine(i, "itmOId", e.target.value)}
                className="col-span-2 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800">
                <option value="">Select...</option>
                {availableItems.map((it) => <option key={it.id} value={it.id}>{it.itmCode} — {it.itmName}</option>)}
              </select>
              {(["reject", "excess", "short", "assort"] as const).map((f) => (
                <input key={f} type="number" min="0" step="0.01" value={line[f]}
                  onChange={(e) => updateLine(i, f, e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              ))}
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={handleSubmit} loading={submitting}>Save Adjustment</Button>
        </div>
      </Card>
    </AppLayout>
  );
}
