"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Edit2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import { fetchAssortments, type Assortment } from "./server";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AssortmentListPage() {
  const [list, setList] = useState<Assortment[]>([]);
  const [loading, setLoading] = useState(true);
  const { can } = usePermissions();
  const canEdit = can("Assortment", "edit");

  useEffect(() => {
    fetchAssortments().then(setList).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Assortment List" action={{ label: "New Assortment", onClick: () => window.location.href = "/assortment" }} />
      <Table loading={loading} data={list}
        columns={[
          { key: "code", header: "Code" },
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "type", header: "Type" },
          { key: "netAmt", header: "Amount", render: (r) => `৳ ${formatCurrency(r.netAmt ?? 0)}`, className: "text-right" },
          {
            key: "actions", header: "",
            render: (r) =>
              canEdit ? (
                <Link href={`/assortment/${r.id}`} className="text-primary-800 hover:underline text-xs" title="Edit">
                  <Edit2 size={14} />
                </Link>
              ) : null,
          },
        ]}
      />
    </AppLayout>
  );
}
