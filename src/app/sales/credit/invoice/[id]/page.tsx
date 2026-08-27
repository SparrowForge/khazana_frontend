"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Link2, Check } from "lucide-react";
import {
  fetchCreditInvoice,
  publicInvoiceUrl,
  type CreditInvoice,
} from "@/lib/invoice/creditInvoice";
import {
  ThermalInvoice,
  CorporateInvoice,
  CreditSaleChallan,
  InvoicePrintStyles,
  type InvoiceFormat,
} from "@/components/sales/CreditInvoiceDocument";
import { isFactoryBranch } from "@/lib/branch";

/** Copy the customer link. `navigator.share` first where the OS offers it (a
 *  phone at the counter hands straight off to WhatsApp), clipboard otherwise. */
function ShareInvoiceButton({ id, invoiceNo }: { id: string; invoiceNo: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = publicInvoiceUrl(id);
    if (!url) return;
    const text = `Invoice ${invoiceNo} — Khazana Mithai`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch {
        // Cancelled, or the OS sheet refused — fall through to the clipboard so
        // the button still does something useful.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invoice link copied — anyone with it can view this invoice");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <button
      onClick={share}
      title="Copy a public link to send the customer"
      className="flex items-center gap-1.5 border border-sage-400 bg-white hover:bg-sage-100 text-gray-700 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
    >
      {copied ? <Check size={15} className="text-primary-700" /> : <Link2 size={15} />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}

export default function CreditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<CreditInvoice | null>(null);
  const [format, setFormat] = useState<InvoiceFormat>("thermal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchCreditInvoice(id)
      .then((data) => {
        setInv(data);
        // Factory credit sales are corporate documents, so they open on the A4
        // sheet; every other branch keeps the 80mm POS receipt. The invoice's
        // own branch decides, not the session's.
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

  if (error || !inv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100">
        <div className="text-center">
          <p className="text-gray-500 mb-3">Credit sale invoice not found.</p>
          <button onClick={() => router.push("/sales")} className="text-primary-700 underline text-sm">
            Back to Sales
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <InvoicePrintStyles format={format} />

      <div className="min-h-screen bg-sage-200 flex flex-col">
        <div className="no-print bg-white border-b border-sage-300 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => router.push("/sales")}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← Back to Sales
          </button>

          <h1 className="font-semibold text-gray-800">
            {format === "challan" ? "Delivery Challan" : "Credit Invoice"} — {inv.invoiceNo}
          </h1>

          <div className="flex items-center gap-3">
            {/* Format switch */}
            <div className="flex rounded-lg border border-sage-300 overflow-hidden text-sm">
              <button
                onClick={() => setFormat("thermal")}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  format === "thermal" ? "bg-primary-700 text-white" : "bg-white text-gray-600 hover:bg-sage-100"
                }`}
              >
                POS Receipt
              </button>
              <button
                onClick={() => setFormat("corporate")}
                className={`px-3 py-1.5 font-medium transition-colors border-l border-sage-300 ${
                  format === "corporate" ? "bg-primary-700 text-white" : "bg-white text-gray-600 hover:bg-sage-100"
                }`}
              >
                Corporate (A4)
              </button>
              {/* Staff-only: the challan travels with the goods, so it is not
                  offered on the customer's shared link. */}
              <button
                onClick={() => setFormat("challan")}
                title="The corporate sheet with the values removed — what goes with the delivery"
                className={`px-3 py-1.5 font-medium transition-colors border-l border-sage-300 ${
                  format === "challan" ? "bg-primary-700 text-white" : "bg-white text-gray-600 hover:bg-sage-100"
                }`}
              >
                Challan (A4)
              </button>
            </div>

            <ShareInvoiceButton id={id} invoiceNo={inv.invoiceNo} />

            <button
              onClick={() => window.print()}
              className="bg-primary-800 hover:bg-primary-700 text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors"
            >
              🖨 Print
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center py-10 overflow-x-auto">
          <div className="shadow-2xl rounded-sm">
            {format === "thermal" ? (
              <ThermalInvoice inv={inv} />
            ) : format === "challan" ? (
              <CreditSaleChallan inv={inv} />
            ) : (
              <CorporateInvoice inv={inv} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
