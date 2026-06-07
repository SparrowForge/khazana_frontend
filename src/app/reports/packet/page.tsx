"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import ReportFilter from "@/components/reports/ReportFilter";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface PacketRow { id: number; code?: string; name?: string; received?: number; issued?: number; balance?: number; }

export default function PacketAnalysisPage() {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<PacketRow[]>([]);
  const [loading, setLoading] = useState(false);

  const runReport = () => {
    setLoading(true);
    api.get(`/reports/packet?from=${from}&to=${to}`)
      .then((res) => setData(res.data.data ?? res.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  return (
    <AppLayout>
      <PageHeader title="Packet Analysis Report" />
      <ReportFilter fromDate={from} toDate={to} onFromDate={setFrom} onToDate={setTo} onRun={runReport} loading={loading} />
      <Table loading={loading} data={data}
        columns={[
          { key: "code", header: "Packet Code" },
          { key: "name", header: "Packet Name" },
          { key: "received", header: "Received", render: (r) => formatCurrency(r.received ?? 0), className: "text-right" },
          { key: "issued", header: "Issued", render: (r) => formatCurrency(r.issued ?? 0), className: "text-right" },
          { key: "balance", header: "Balance", render: (r) => formatCurrency(r.balance ?? 0), className: "text-right font-semibold" },
        ]}
      />
    </AppLayout>
  );
}
