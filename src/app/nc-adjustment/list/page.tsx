"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface NC { id: string; ncmstrCode?: string; ncmstrDate?: string; ncmstrName?: string; ncmstrContactNo?: string; }

export default function NCAdjustmentListPage() {
  const [list, setList] = useState<NC[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/nc").then((res) => setList(res.data.data ?? res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <PageHeader title="NC Adjustment List" action={{ label: "New NC", onClick: () => window.location.href = "/nc-adjustment" }} />
      <Table loading={loading} data={list}
        columns={[
          { key: "ncmstrCode", header: "NC Code" },
          { key: "ncmstrDate", header: "Date", render: (r) => formatDate(r.ncmstrDate) },
          { key: "ncmstrName", header: "Name" },
          { key: "ncmstrContactNo", header: "Contact" },
        ]}
      />
    </AppLayout>
  );
}
