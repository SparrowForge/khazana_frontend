"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Card from "@/components/ui/Card";
import api from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

interface LedgerEntry { id: number; date?: string; description?: string; debit?: number; credit?: number; balance?: number; }
interface CustomerInfo { code: string; name: string; }

export default function CustomerLedgerPage() {
  const { id } = useParams();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/customers/${id}`).then((res) => setCustomer(res.data)).catch(() => {});
    api.get(`/customers/${id}/ledger`)
      .then((res) => setLedger(res.data.data ?? res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const totalDebit = ledger.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = ledger.reduce((s, l) => s + (l.credit ?? 0), 0);

  return (
    <AppLayout>
      <PageHeader title={`Customer Ledger${customer ? ` — ${customer.name}` : ""}`} subtitle={customer?.code} />
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card><div className="text-sm text-gray-500">Total Sales</div><div className="text-xl font-bold text-red-600 mt-1">৳ {formatCurrency(totalDebit)}</div></Card>
        <Card><div className="text-sm text-gray-500">Total Payments</div><div className="text-xl font-bold text-green-600 mt-1">৳ {formatCurrency(totalCredit)}</div></Card>
        <Card><div className="text-sm text-gray-500">Balance Due</div><div className="text-xl font-bold text-primary-800 mt-1">৳ {formatCurrency(totalDebit - totalCredit)}</div></Card>
      </div>
      <Table loading={loading} data={ledger}
        columns={[
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "description", header: "Description" },
          { key: "debit", header: "Debit", render: (r) => r.debit ? `৳ ${formatCurrency(r.debit)}` : "-", className: "text-right" },
          { key: "credit", header: "Credit", render: (r) => r.credit ? `৳ ${formatCurrency(r.credit)}` : "-", className: "text-right" },
          { key: "balance", header: "Balance", render: (r) => `৳ ${formatCurrency(r.balance ?? 0)}`, className: "text-right font-medium" },
        ]}
      />
    </AppLayout>
  );
}
