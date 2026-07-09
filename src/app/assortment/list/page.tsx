"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Edit2, Trash2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import { fetchAssortments, deleteAssortment, type Assortment } from "./server";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

export default function AssortmentListPage() {
  const [list, setList] = useState<Assortment[]>([]);
  const [loading, setLoading] = useState(true);
  const { can } = usePermissions();
  const canEdit = can("Assortment", "edit");
  const canDelete = can("Assortment", "delete");

  const load = () => {
    setLoading(true);
    fetchAssortments().then(setList).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleDelete = async (a: Assortment) => {
    if (!confirm(`Delete assortment "${a.code ?? a.id}"? Master + details are removed and its deducted stock is restored.`)) return;
    try {
      await deleteAssortment(a.id);
      toast.success("Assortment deleted");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete"));
    }
  };

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
            render: (r) => (
              <div className="flex gap-2">
                {canEdit && (
                  <Link href={`/assortment/${r.id}`} className="text-primary-800 hover:underline text-xs" title="Edit">
                    <Edit2 size={14} />
                  </Link>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600" title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
                {!canEdit && !canDelete && <span className="text-gray-300">—</span>}
              </div>
            ),
          },
        ]}
      />
    </AppLayout>
  );
}
