"use client";
import { useMemo, useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { MessageCircle, Copy } from "lucide-react";
import { fetchDailySales, type DailySalesReport, type DailySalesBranchRow } from "./server";
import { buildShareText, periodLabel, tk } from "./shareText";
import { fetchBranches, type Branch } from "@/app/admin/branches/server";
import { getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";
import type { ExportColumn } from "@/lib/export/reportExport";

const today = () => new Date().toISOString().split("T")[0];

export default function DailySalesReportPage() {
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [report, setReport] = useState<DailySalesReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches({ page: 1, limit: 100 })
      .then(({ items }) => setBranches(items))
      .catch(() => {});
  }, []);

  const runReport = () => {
    setLoading(true);
    fetchDailySales(fromDate, toDate, branchId || undefined)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        toast.error(getErrorMessage(err, "Failed to load the report"));
      })
      .finally(() => setLoading(false));
  };

  const shareText = useMemo(() => (report ? buildShareText(report) : ""), [report]);

  /** wa.me with no number opens WhatsApp's own "share with…" picker, so the
   *  sender chooses the group or contact — which is how this report is sent. */
  const shareToWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Report copied — paste it anywhere");
    } catch {
      toast.error("Could not copy. Select the text below and copy it manually.");
    }
  };

  const exportColumns = useMemo<ExportColumn<DailySalesBranchRow>[]>(
    () => [
      { header: "Branch", value: (r) => `${r.code} — ${r.name}`, width: 28 },
      { header: "Sale", value: (r) => r.sale, numeric: true },
      { header: "Invoice", value: (r) => r.invoiceCount, numeric: true },
      { header: "Online Sale", value: (r) => r.onlineSale, numeric: true },
      { header: "Online Invoice", value: (r) => r.onlineInvoiceCount, numeric: true },
    ],
    [],
  );

  return (
    <AppLayout>
      <PageHeader
        title="Daily Sales Report"
        subtitle="Sale and invoice count per branch, with the Food Panda / Foodi online share"
      />

      <div className="no-print flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-sage-300">
        <Input
          label="From Date"
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setToDate(e.target.value); }}
          className="w-40"
        />
        <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        <Select
          label="Branch"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          placeholder="All Branches"
          options={branches.map((b) => ({ value: String(b.id), label: b.branchName }))}
          className="w-52"
        />
        <Button onClick={runReport} loading={loading} className="mb-0.5">Run Report</Button>
        {report && (
          <>
            <Button variant="secondary" onClick={shareToWhatsApp} className="mb-0.5">
              <MessageCircle size={15} className="mr-1.5" /> Share on WhatsApp
            </Button>
            <Button variant="secondary" onClick={copyText} className="mb-0.5">
              <Copy size={15} className="mr-1.5" /> Copy Text
            </Button>
            <Button variant="secondary" onClick={() => window.print()} className="mb-0.5">🖨 Print</Button>
          </>
        )}
        <ReportExportButtons
          className="mb-0.5 ml-auto"
          showPrint={false}
          rows={report?.branches ?? []}
          columns={exportColumns}
          meta={{
            title: "Daily Sales Report",
            subtitle: report ? `${report.branch.name} · ${periodLabel(report.fromDate, report.toDate)}` : "",
          }}
        />
      </div>

      {report && (
        <>
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 12mm; }
              body * { visibility: hidden !important; }
              #report, #report * { visibility: visible !important; }
              #report { position: absolute; top: 0; left: 0; width: 100%; }
              .no-print { display: none !important; }
            }
          `}</style>
          <Report data={report} />
        </>
      )}
    </AppLayout>
  );
}

/** The sheet, laid out as the message reads — one block per branch, then the
 *  totals. Deliberately narrow: this is a phone-shaped report, not a wide grid. */
function Report({ data }: { data: DailySalesReport }) {
  const { company, branches, totals } = data;
  const outlets = branches.filter((b) => !b.isFactory);
  const factory = branches.filter((b) => b.isFactory);

  const Line = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-6 border-b border-sage-300 px-2 py-[3px]">
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );

  const BranchBlock = ({ b, label }: { b: DailySalesBranchRow; label: string }) => (
    <div className="mb-3">
      <Line label={`${label} Sale`} value={`Tk ${tk(b.sale)}`} />
      <Line label="Invoice" value={String(b.invoiceCount)} />
      {(b.onlineSale > 0 || b.onlineInvoiceCount > 0) && (
        <>
          <Line label="Online Sale" value={`Tk ${tk(b.onlineSale)}`} />
          <Line label="Invoice" value={String(b.onlineInvoiceCount)} />
        </>
      )}
    </div>
  );

  return (
    <div id="report" className="bg-white text-black text-[12px] border border-sage-400 p-5 max-w-md">
      <div className="text-center mb-3">
        <div className="font-extrabold text-[15px] italic">{company.name}</div>
        {company.address && <div className="text-[10px] italic">{company.address}</div>}
      </div>
      <div className="border-t border-black mb-3" />

      <div className="font-bold text-[13px] mb-3">
        Sales Report of {periodLabel(data.fromDate, data.toDate)}
        {data.branch.id ? ` — ${data.branch.name}` : ""}
      </div>

      {outlets.map((b) => <BranchBlock key={b.id} b={b} label={b.code} />)}
      {factory.map((b) => <BranchBlock key={b.id} b={b} label="Factory" />)}

      <div className="border-t-2 border-black mt-2 pt-2">
        <Line label="Total Outlet Sales" value={`Tk ${tk(totals.outletSales)}`} />
        <Line label="Total Online" value={`Tk ${tk(totals.onlineSales)}`} />
        <Line label="Total Sale" value={`Tk ${tk(totals.totalSales)}`} />
        <div className="mt-2">
          <Line label="Total (MTD)" value={`Tk ${tk(totals.mtdSales)}`} />
        </div>
      </div>

      {/* Online money is already inside each branch's Sale figure, so the memo
          line above must not be added to the total. Say so on the sheet. */}
      <p className="text-[9px] text-gray-500 mt-3 leading-snug">
        Online sales (Food Panda &amp; Foodi) are included in each branch&apos;s sale figure —
        Total Sale = Total Outlet Sales + Factory Sale.
      </p>
    </div>
  );
}
