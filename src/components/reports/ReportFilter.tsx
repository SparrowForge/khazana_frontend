"use client";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface ReportFilterProps {
  fromDate: string;
  toDate: string;
  onFromDate: (v: string) => void;
  onToDate: (v: string) => void;
  onRun: () => void;
  loading?: boolean;
  extra?: React.ReactNode;
}

export default function ReportFilter({ fromDate, toDate, onFromDate, onToDate, onRun, loading, extra }: ReportFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5 p-4 bg-white rounded-lg border border-gray-200">
      <Input label="From Date" type="date" value={fromDate} onChange={(e) => onFromDate(e.target.value)} className="w-40" />
      <Input label="To Date" type="date" value={toDate} onChange={(e) => onToDate(e.target.value)} className="w-40" />
      {extra}
      <Button onClick={onRun} loading={loading} className="mb-0.5">Run Report</Button>
    </div>
  );
}
