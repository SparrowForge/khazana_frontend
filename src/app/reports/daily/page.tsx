"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { fetchDailySummary, type DailySummary, type SaleRow } from "./server";
import { formatCurrency } from "@/lib/utils";

export default function DailySummaryPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [details, setDetails] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);

  const runReport = () => {
    setLoading(true);
    fetchDailySummary(date)
      .then(({ summary: s, details: d }) => { setSummary(s); setDetails(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  return (
    <AppLayout>
      <PageHeader title="Daily Summary" />
      <div className="flex items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-gray-200">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        <Button onClick={runReport} loading={loading}>Run Report</Button>
      </div>
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: "Cash Sales", value: summary.cashSales ?? 0 },
            { label: "Credit Sales", value: summary.creditSales ?? 0 },
            { label: "VAT Cash Sales", value: summary.vatCashSales ?? 0 },
            { label: "VAT Credit Sales", value: summary.vatCreditSales ?? 0 },
          ].map((s) => (
            <Card key={s.label}>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-800 mt-1">৳ {formatCurrency(s.value)}</p>
            </Card>
          ))}
        </div>
      )}
      <Table loading={loading} data={details}
        columns={[
          { key: "invNo", header: "Invoice No" },
          { key: "type", header: "Type" },
          { key: "netAmount", header: "Amount", render: (r) => `৳ ${formatCurrency(r.netAmount ?? 0)}`, className: "text-right font-medium" },
        ]}
      />
    </AppLayout>
  );
}
