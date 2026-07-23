"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import { useAuthStore } from "@/store/auth.store";
import { fetchSalesHistory, type SalesHistoryReport, type SalesHistoryRow } from "./server";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import { formatCurrency } from "@/lib/utils";
import type { ExportColumn } from "@/lib/export/reportExport";
import { exportExcel } from "@/lib/export/reportExport";

const formatDate = (dateString: string | Date) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

const fmt = (n: number) => formatCurrency(n ?? 0);
const fmtQty = (n: number) => (n ?? 0).toFixed(2);

export default function SalesHistoryPage() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? "");

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [allBranches, setAllBranches] = useState(false);
  const [report, setReport] = useState<SalesHistoryReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches({ page: 1, limit: 100 })
      .then(({ items }) => setBranches(items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionBranchId) setBranchId((b) => b || sessionBranchId);
  }, [sessionBranchId]);

  const runReport = () => {
    if (!allBranches && !branchId) return;
    setLoading(true);
    fetchSalesHistory(fromDate, toDate, allBranches ? undefined : branchId)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  const handleExport = () => {
    if (!report) return;
    const rows: Array<SalesHistoryRow & { si: number }> = report.items.map((item, idx) => ({
      ...item,
      si: idx + 1,
    }));

    const columns: ExportColumn<SalesHistoryRow & { si: number }>[] = [
      { header: "SI#", value: (r) => r.si },
      { header: "Date", value: (r) => formatDate(r.date) },
      { header: "Inv No", value: (r) => r.invoiceNo },
      { header: "Item Name", value: (r) => r.itemName },
      { header: "Qty", value: (r) => fmtQty(r.qty), numeric: true },
      { header: "Price", value: (r) => fmt(r.price), numeric: true },
      { header: "Amount", value: (r) => fmt(r.amount), numeric: true },
      { header: "Discount", value: (r) => fmt(r.discount), numeric: true },
      { header: "Vat", value: (r) => fmt(r.vat), numeric: true },
      { header: "Total Amt", value: (r) => fmt(r.totalAmount), numeric: true },
      { header: "Cash", value: (r) => fmt(r.cash), numeric: true },
      { header: "Bkash", value: (r) => fmt(r.bkash), numeric: true },
      { header: "Nagad", value: (r) => fmt(r.nagad), numeric: true },
      { header: "Brac", value: (r) => fmt(r.brac), numeric: true },
      { header: "UCB", value: (r) => fmt(r.ucb), numeric: true },
      { header: "CITY", value: (r) => fmt(r.city), numeric: true },
      { header: "EBL", value: (r) => fmt(r.ebl), numeric: true },
      { header: "F Panda", value: (r) => fmt(r.fpanda), numeric: true },
      { header: "Pathao", value: (r) => fmt(r.pathao), numeric: true },
      { header: "Foodi", value: (r) => fmt(r.foodi), numeric: true },
      { header: "Credit", value: (r) => fmt(r.credit), numeric: true },
    ];

    exportExcel(rows, columns, {
      title: "Sales History Summary",
      subtitle: `${report.branchName || "All Branches"} · ${formatDate(report.fromDate)} to ${formatDate(report.toDate)}`,
    }).catch(() => {});
  };

  return (
    <AppLayout>
      <PageHeader title="Sales History Summary" />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-gray-200">
        <Input
          label="From Date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-40"
        />
        <Input
          label="To Date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-40"
        />
        <Select
          label="Branch"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-48"
          disabled={allBranches}
        />
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 select-none">
          <input
            type="checkbox"
            checked={allBranches}
            onChange={(e) => setAllBranches(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-800 focus:ring-primary-800"
          />
          All Branches
        </label>
        <Button onClick={runReport} loading={loading} className="mb-0.5">
          Run Report
        </Button>
        {report && (
          <>
            <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">
              🖨 Print
            </Button>
            <Button variant="secondary" onClick={handleExport} className="mb-0.5">
              📊 Excel
            </Button>
          </>
        )}
      </div>

      {report && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-center text-lg font-semibold">{report.branchName || "All Branches"}</h2>
            {report.branchAddress && <p className="text-center text-sm text-gray-600">{report.branchAddress}</p>}
            <p className="text-center text-sm text-gray-600 mt-1">
              Sales History Summary On : {formatDate(report.fromDate)} to {formatDate(report.toDate)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table
              loading={false}
              data={report.items.map((item, idx) => ({ ...item, si: idx + 1 }))}
              columns={[
                { key: "si", header: "SI#", className: "w-12" },
                { key: "date", header: "Date", render: (r) => formatDate(r.date) },
                { key: "invoiceNo", header: "Inv No" },
                { key: "itemName", header: "Item Name" },
                { key: "qty", header: "Qty", className: "text-right", render: (r) => fmtQty(r.qty) },
                { key: "price", header: "Price", className: "text-right", render: (r) => fmt(r.price) },
                { key: "amount", header: "Amount", className: "text-right", render: (r) => fmt(r.amount) },
                { key: "discount", header: "Discount", className: "text-right", render: (r) => fmt(r.discount) },
                { key: "vat", header: "Vat", className: "text-right", render: (r) => fmt(r.vat) },
                { key: "totalAmount", header: "Total Amt", className: "text-right", render: (r) => fmt(r.totalAmount) },
                { key: "cash", header: "Cash", className: "text-right", render: (r) => fmt(r.cash) },
                { key: "bkash", header: "Bkash", className: "text-right", render: (r) => fmt(r.bkash) },
                { key: "nagad", header: "Nagad", className: "text-right", render: (r) => fmt(r.nagad) },
                { key: "brac", header: "Brac", className: "text-right", render: (r) => fmt(r.brac) },
                { key: "ucb", header: "UCB", className: "text-right", render: (r) => fmt(r.ucb) },
                { key: "city", header: "CITY", className: "text-right", render: (r) => fmt(r.city) },
                { key: "ebl", header: "EBL", className: "text-right", render: (r) => fmt(r.ebl) },
                { key: "fpanda", header: "F Panda", className: "text-right", render: (r) => fmt(r.fpanda) },
                { key: "pathao", header: "Pathao", className: "text-right", render: (r) => fmt(r.pathao) },
                { key: "foodi", header: "Foodi", className: "text-right", render: (r) => fmt(r.foodi) },
                { key: "credit", header: "Credit", className: "text-right", render: (r) => fmt(r.credit) },
              ]}
            />
          </div>

          {report.dailySubTotals.length > 0 && (
            <div className="border-t border-gray-200 p-4">
              <h3 className="text-sm font-semibold mb-3">Daily Sub Totals</h3>
              <div className="overflow-x-auto">
                <Table
                  loading={false}
                  data={report.dailySubTotals}
                  columns={[
                    { key: "date", header: "Date", render: (r) => formatDate(r.date) },
                    { key: "qty", header: "Qty", className: "text-right", render: (r) => fmtQty(r.qty) },
                    { key: "amount", header: "Amount", className: "text-right", render: (r) => fmt(r.amount) },
                    { key: "discount", header: "Discount", className: "text-right", render: (r) => fmt(r.discount) },
                    { key: "vat", header: "Vat", className: "text-right", render: (r) => fmt(r.vat) },
                    { key: "totalAmount", header: "Total Amt", className: "text-right", render: (r) => fmt(r.totalAmount) },
                    { key: "cash", header: "Cash", className: "text-right", render: (r) => fmt(r.cash) },
                    { key: "bkash", header: "Bkash", className: "text-right", render: (r) => fmt(r.bkash) },
                    { key: "nagad", header: "Nagad", className: "text-right", render: (r) => fmt(r.nagad) },
                    { key: "brac", header: "Brac", className: "text-right", render: (r) => fmt(r.brac) },
                    { key: "ucb", header: "UCB", className: "text-right", render: (r) => fmt(r.ucb) },
                    { key: "city", header: "CITY", className: "text-right", render: (r) => fmt(r.city) },
                    { key: "ebl", header: "EBL", className: "text-right", render: (r) => fmt(r.ebl) },
                    { key: "fpanda", header: "F Panda", className: "text-right", render: (r) => fmt(r.fpanda) },
                    { key: "pathao", header: "Pathao", className: "text-right", render: (r) => fmt(r.pathao) },
                    { key: "foodi", header: "Foodi", className: "text-right", render: (r) => fmt(r.foodi) },
                    { key: "credit", header: "Credit", className: "text-right", render: (r) => fmt(r.credit) },
                  ]}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
