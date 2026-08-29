"use client";

// The shared copy of a Demand Report, reached by the public link.
//
// No login: whoever holds the URL sees this. It renders the same sheet the
// factory sees, minus everything that only makes sense to staff — no filter
// bar, no export, nothing that links deeper into the app. Print is kept, since
// the point of sharing a report is usually to print or forward it.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DemandReportSheet, { DemandReportPrintStyles } from "@/components/reports/DemandReportSheet";
import { fetchSharedDemandReport, type DemandReport } from "@/app/factory/demand-report/server";

export default function SharedDemandReportPage() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<DemandReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchSharedDemandReport(token)
      .then(setReport)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100">
        <div className="text-gray-400 text-sm">Loading report…</div>
      </div>
    );
  }

  // Deliberately vague: someone probing tokens learns only that this one is not
  // live, not whether it ever was.
  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100 px-6">
        <div className="text-center">
          <p className="text-gray-700 font-medium mb-1">Report unavailable</p>
          <p className="text-gray-500 text-sm">This link is not valid. Please ask for a new one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sage-100 py-6 px-4">
      <DemandReportPrintStyles />
      <div className="max-w-5xl mx-auto">
        <div className="no-print mb-3 flex justify-end">
          <button
            onClick={() => window.print()}
            className="border border-sage-400 bg-white hover:bg-sage-100 text-gray-700 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            🖨 Print
          </button>
        </div>
        <DemandReportSheet data={report} />
      </div>
    </div>
  );
}
