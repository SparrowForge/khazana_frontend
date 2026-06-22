"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Input from "@/components/ui/Input";
import { fetchAuditLog, type AuditLog } from "./server";
import { formatDateTime } from "@/lib/utils";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAuditLog().then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((l) =>
    (l.userName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (l.actionPage ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (l.actionDone ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader title="Audit Log" subtitle="System activity history" />
      <div className="mb-4">
        <Input placeholder="Search by user, page, or action..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <Table loading={loading} data={filtered}
        columns={[
          { key: "date", header: "Date/Time", render: (r) => formatDateTime(r.date) },
          { key: "userName", header: "User" },
          { key: "module", header: "Module" },
          { key: "actionPage", header: "Page" },
          { key: "actionDone", header: "Action" },
          { key: "ipAddress", header: "IP Address" },
        ]}
      />
    </AppLayout>
  );
}
