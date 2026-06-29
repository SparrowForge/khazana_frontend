"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import { Edit2, Trash2, Plus } from "lucide-react";
import { fetchNcAdjustments, deleteNcAdjustment, type NC } from "./server";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";

export default function NCAdjustmentListPage() {
  const router = useRouter();
  const [list, setList] = useState<NC[]>([]);
  const [loading, setLoading] = useState(true);

  const { can } = usePermissions();
  const canAdd = can("NCAdjustment", "add");
  const canEdit = can("NCAdjustment", "edit");
  const canDelete = can("NCAdjustment", "delete");

  const load = () => {
    setLoading(true);
    fetchNcAdjustments().then(setList).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleDelete = async (nc: NC) => {
    if (!confirm(`Delete NC adjustment "${nc.ncmstrCode ?? nc.id}"? Master + details are removed and its stock additions reversed.`)) return;
    try {
      await deleteNcAdjustment(nc.id);
      toast.success("NC Adjustment deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="NC Adjustment List"
        action={canAdd ? { label: "New NC", onClick: () => router.push("/nc-adjustment"), icon: <Plus size={16} /> } : undefined}
      />
      <Table loading={loading} data={list}
        columns={[
          { key: "ncmstrCode", header: "NC Code" },
          { key: "ncmstrDate", header: "Date", render: (r) => formatDate(r.ncmstrDate) },
          { key: "ncmstrName", header: "Name" },
          { key: "ncmstrContactNo", header: "Contact" },
          { key: "ncmstrReference", header: "Reference" },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-2">
              {canEdit && <button onClick={() => router.push(`/nc-adjustment/${r.id}`)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>}
              {canDelete && <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
              {!canEdit && !canDelete && <span className="text-gray-300">—</span>}
            </div>
          )},
        ]}
      />
    </AppLayout>
  );
}
