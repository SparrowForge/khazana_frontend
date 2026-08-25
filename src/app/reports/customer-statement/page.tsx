"use client";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import ReportFilter from "@/components/reports/ReportFilter";
import Select from "@/components/ui/Select";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import {
  fetchCustomers,
  fetchCustomerStatement,
  type Customer,
  type CustomerStatement,
  type StatementRow,
} from "./server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";

// The statement is printed as a ledger: an Opening Balance line, the period's
// entries, then a Total line. `kind` marks the two synthetic rows so they can
// be styled (and dated) differently without leaking into the ledger maths.
type DisplayRow = StatementRow & { kind: "opening" | "entry" | "total" };

const EMPTY: CustomerStatement = {
  openingBalance: 0,
  items: [],
  totals: { debit: 0, credit: 0, closingBalance: 0 },
};

const money = (n: number | undefined) => `৳ ${formatCurrency(n ?? 0)}`;

const exportColumns: ExportColumn<DisplayRow>[] = [
  { header: "Date", value: (r) => (r.kind === "entry" ? formatDate(r.date) : "") },
  { header: "Invoice No", value: (r) => r.invoiceNo ?? "" },
  { header: "Description", value: (r) => r.description, width: 34 },
  { header: "Debit", value: (r) => r.debit ?? 0, numeric: true },
  { header: "Credit", value: (r) => r.credit ?? 0, numeric: true },
  { header: "Balance", value: (r) => r.balance ?? 0, numeric: true },
];

export default function CustomerStatementPage() {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [customerCode, setCustomerCode] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statement, setStatement] = useState<CustomerStatement>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCustomers().then(setCustomers).catch(() => {});
  }, []);

  const runReport = () => {
    setLoading(true);
    fetchCustomerStatement(from, to, customerCode)
      .then(setStatement)
      .catch(() => setStatement(EMPTY))
      .finally(() => setLoading(false));
  };

  const rows: DisplayRow[] = useMemo(() => {
    const entries = statement.items.map((r) => ({ ...r, kind: "entry" as const }));
    if (!entries.length && !statement.openingBalance) return [];
    return [
      {
        id: "__opening" as unknown as number,
        description: "Opening Balance",
        invoiceNo: "",
        balance: statement.openingBalance,
        kind: "opening" as const,
      },
      ...entries,
      {
        id: "__total" as unknown as number,
        description: "Total",
        invoiceNo: "",
        debit: statement.totals.debit,
        credit: statement.totals.credit,
        balance: statement.totals.closingBalance,
        kind: "total" as const,
      },
    ];
  }, [statement]);

  const customerName = customers.find((c) => c.code === customerCode)?.name ?? "All customers";

  return (
    <AppLayout>
      <PageHeader title="Customer Statement" />
      <ReportFilter fromDate={from} toDate={to} onFromDate={setFrom} onToDate={setTo} onRun={runReport} loading={loading}
        extra={
          <Select label="Customer" value={customerCode} onChange={(e) => setCustomerCode(e.target.value)}
            placeholder="All customers" options={customers.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
            className="w-56" />
        }
      />
      <div className="mb-3 flex justify-end">
        <ReportExportButtons
          rows={rows}
          columns={exportColumns}
          meta={{
            title: "Customer Statement",
            subtitle: [customerName, `${formatDate(from)} — ${formatDate(to)}`].join(" · "),
            // Six columns would otherwise trip the auto-landscape threshold,
            // but a statement's columns are narrow — it belongs on portrait A4.
            forcePortrait: true,
          }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: "Opening Balance", value: statement.openingBalance },
          { label: "Debit (Sales)", value: statement.totals.debit },
          { label: "Credit (Received)", value: statement.totals.credit },
          { label: "Closing Balance", value: statement.totals.closingBalance },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-lg font-bold text-gray-800 mt-1">{money(s.value)}</p>
          </Card>
        ))}
      </div>

      <Table loading={loading} data={rows}
        columns={[
          { key: "date", header: "Date", render: (r) => (r.kind === "entry" ? formatDate(r.date) : "") },
          { key: "invoiceNo", header: "Invoice No", render: (r) => r.invoiceNo || "" },
          {
            key: "description",
            header: "Description",
            render: (r) => (r.kind === "entry" ? r.description : <span className="font-semibold">{r.description}</span>),
          },
          {
            key: "debit",
            header: "Debit",
            render: (r) => (r.kind === "opening" ? "" : r.debit ? money(r.debit) : "-"),
            className: "text-right",
          },
          {
            key: "credit",
            header: "Credit",
            render: (r) => (r.kind === "opening" ? "" : r.credit ? money(r.credit) : "-"),
            className: "text-right",
          },
          { key: "balance", header: "Balance", render: (r) => money(r.balance), className: "text-right font-semibold" },
        ]}
      />
    </AppLayout>
  );
}
