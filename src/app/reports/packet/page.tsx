"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import ReportFilter from "@/components/reports/ReportFilter";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { fetchPacketReport, type PacketRow } from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";

const exportColumns: ExportColumn<PacketRow>[] = [
  { header: "Packet Code", value: (r) => r.code },
  { header: "Packet Name", value: (r) => r.name },
  { header: "Received", value: (r) => r.received ?? 0, numeric: true },
  { header: "Issued", value: (r) => r.issued ?? 0, numeric: true },
  { header: "Balance", value: (r) => r.balance ?? 0, numeric: true },
];

export default function PacketAnalysisPage() {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<PacketRow[]>([]);
  const [loading, setLoading] = useState(false);

  const runReport = () => {
    setLoading(true);
    fetchPacketReport(from, to).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  };

  return (
    <AppLayout>
      <PageHeader title="Packet Analysis Report" />
      <ReportFilter fromDate={from} toDate={to} onFromDate={setFrom} onToDate={setTo} onRun={runReport} loading={loading} />
      <div className="mb-3 flex justify-end">
        <ReportExportButtons
          rows={data}
          columns={exportColumns}
          meta={{
            title: "Packet Analysis Report",
            subtitle: `${formatDate(from)} — ${formatDate(to)}`,
          }}
        />
      </div>
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
