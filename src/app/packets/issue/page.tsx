"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { fetchPackets, issuePackets, type PacketOption } from "./server";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";

interface IssueLine { code: string; qty: string; }

export default function PacketIssuePage() {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [issueType, setIssueType] = useState("Sale");
  const [lines, setLines] = useState<IssueLine[]>([{ code: "", qty: "1" }]);
  const [packets, setPackets] = useState<PacketOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPackets().then(setPackets).catch(() => {});
  }, []);

  const addLine = () => setLines([...lines, { code: "", qty: "1" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, f: keyof IssueLine, v: string) => setLines(lines.map((l, idx) => idx === i ? { ...l, [f]: v } : l));

  const handleSubmit = async () => {
    const valid = lines.filter((l) => l.code && parseFloat(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      await issuePackets({ invoiceNo, issueDate, issueType, items: valid.map((l) => ({ code: l.code, qty: parseFloat(l.qty) })) });
      toast.success("Packet issue saved");
      setLines([{ code: "", qty: "1" }]); setInvoiceNo("");
    } catch { toast.error("Failed to save"); } finally { setSubmitting(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Packet Issue" />
      <Card title="Issue Details">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Input label="Invoice No" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          <Input label="Date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <Select label="Issue Type" value={issueType} onChange={(e) => setIssueType(e.target.value)}
            options={[{ value: "Sale", label: "Sale" }, { value: "Internal", label: "Internal" }, { value: "Damaged", label: "Damaged" }]} />
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Select label={i === 0 ? "Packet" : undefined} value={line.code} onChange={(e) => updateLine(i, "code", e.target.value)}
                placeholder="Select packet..." options={packets.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` }))} className="flex-1" />
              <div className="w-28">
                {i === 0 && <label className="text-sm font-medium text-gray-700 mb-1 block">Qty</label>}
                <input type="number" min="1" value={line.qty} onChange={(e) => updateLine(i, "qty", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-800" />
              </div>
              <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 pb-2"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={handleSubmit} loading={submitting}>Save</Button>
        </div>
      </Card>
    </AppLayout>
  );
}
