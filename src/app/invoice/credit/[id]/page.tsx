"use client";

// The customer's copy of a credit-sale invoice, reached by the share link.
//
// No login: whoever holds the URL sees this. It renders the same two documents
// the counter prints, minus everything that only makes sense to staff — no
// back-to-Sales, no share control, nothing that links deeper into the app.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchPublicCreditInvoice, type CreditInvoice } from "@/lib/invoice/creditInvoice";
import {
  ThermalInvoice,
  CorporateInvoice,
  InvoicePrintStyles,
  type InvoiceFormat,
} from "@/components/sales/CreditInvoiceDocument";
import { isFactoryBranch } from "@/lib/branch";

export default function PublicCreditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<CreditInvoice | null>(null);
  const [format, setFormat] = useState<InvoiceFormat>("thermal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPublicCreditInvoice(id)
      .then((data) => {
        setInv(data);
        if (isFactoryBranch({ branchCode: data.branch?.code, branchName: data.branch?.name })) {
          setFormat("corporate");
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100">
        <div className="text-gray-400 text-sm">Loading invoice…</div>
      </div>
    );
  }

  // Deliberately vague: a stranger probing ids learns only that this one isn't
  // a live invoice, not whether it ever was.
  if (error || !inv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100 px-6">
        <div className="text-center">
          <p className="text-gray-700 font-medium mb-1">Invoice unavailable</p>
          <p className="text-gray-500 text-sm">
            This link is not valid. Please ask for a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <InvoicePrintStyles format={format} />

      <div className="min-h-screen bg-sage-200 flex flex-col">
        <div className="no-print bg-white border-b border-sage-300 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-semibold text-gray-800">Invoice — {inv.invoiceNo}</h1>

          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-sage-300 overflow-hidden text-sm">
              <button
                onClick={() => setFormat("thermal")}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  format === "thermal" ? "bg-primary-700 text-white" : "bg-white text-gray-600 hover:bg-sage-100"
                }`}
              >
                Receipt
              </button>
              <button
                onClick={() => setFormat("corporate")}
                className={`px-3 py-1.5 font-medium transition-colors border-l border-sage-300 ${
                  format === "corporate" ? "bg-primary-700 text-white" : "bg-white text-gray-600 hover:bg-sage-100"
                }`}
              >
                A4
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="bg-primary-800 hover:bg-primary-700 text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors"
            >
              🖨 Print / Save PDF
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center py-10 overflow-x-auto">
          <div className="shadow-2xl rounded-sm">
            {format === "thermal" ? <ThermalInvoice inv={inv} /> : <CorporateInvoice inv={inv} />}
          </div>
        </div>
      </div>
    </>
  );
}
