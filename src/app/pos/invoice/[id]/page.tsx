"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { posSalesApi, type PosSale } from "@/lib/services/pos.service";
import {
  CorporateInvoice,
  CreditSaleChallan,
  InvoicePrintStyles,
  type InvoiceFormat,
} from "@/components/sales/CreditInvoiceDocument";
import { posSaleToInvoice } from "@/lib/invoice/posInvoice";
import { useAuthStore } from "@/store/auth.store";
import { isFactoryBranch } from "@/lib/branch";

// ── Helpers ─────────────────────────────────────────────────
const fmt = (n: number | string) => Number(n).toFixed(2);
/** Qty can be fractional (weight-priced items) — never round it away. */
const fmtQty = (n: number | string) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${h}:${min} ${ampm}`;
}

// ── Invoice component (also used by print) ───────────────────
function Receipt({ sale }: { sale: PosSale }) {
  const totalAmount = Number(sale.totalAmount);
  const vatAmount = Number(sale.vatAmount);
  const payableAmount = Number(sale.payableAmount);
  const paidAmount = Number(sale.paidAmount);
  const changeAmount = Number(sale.changeAmount);
  const discountAmount = Number(sale.discountAmount);
  // Discount is only ever stored as a flat amount — derive the % (of the
  // VAT-inclusive gross) so it always displays as a percentage on the invoice.
  const grossAmount = totalAmount + vatAmount;
  const discountPercent = grossAmount > 0 ? (discountAmount / grossAmount) * 100 : 0;

  return (
    <div
      id="receipt"
      className="font-mono text-[11px] leading-[1.55] text-black bg-white w-[302px] px-3 py-4 mx-auto"
      style={{ fontFamily: "'Courier New', Courier, monospace" }}
    >
      {/* ── Header ── */}
      <div className="text-center mb-1">
        <div className="font-bold text-[14px] tracking-widest">KHAZANA MITHAI</div>
        <div className="text-[10px]">{sale.branch?.name} Branch</div>
        <div className="text-[10px]">{sale.branch?.address}</div>
        <div className="text-[10px]">VAT Reg No: {sale.branch?.vatNo || "—"}</div>
        <div className="text-[10px]">[Mushak 6.3]</div>
        <div className="text-[10px]">Tel: {sale.branch?.mobileNo || "—"}</div>
        <div className="text-[10px]">www.khazanamithai.com</div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      {/* ── Meta ── */}
      <div className="text-[10px]">
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDateTime(sale.dateTime)}</span>
        </div>
        <div className="flex justify-between">
          <span>Invoice:</span>
          <span className="font-bold">{sale.invoiceNo}</span>
        </div>
        <div className="flex justify-between">
          <span>Type:</span>
          <span>{sale.bankName ? `${sale.salesType}(${sale.bankName})` : sale.salesType}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      {/* ── Column Header ── */}
      <div className="flex text-[10px] font-bold">
        <span className="flex-1">ITEM</span>
        <span className="w-8 text-center">QTY</span>
        <span className="w-12 text-right">RATE</span>
        <span className="w-8 text-right">VAT</span>
        <span className="w-14 text-right">TOTAL</span>
      </div>

      <div className="border-t border-dashed border-black my-1" />

      {/* ── Line Items ── */}
      {sale.items.map((item, i) => (
        <div key={i}>
          {/* Item name row */}
          <div className="text-[10px] font-medium truncate">{item.productName}</div>
          {/* Values row */}
          <div className="flex text-[10px] mb-0.5">
            <span className="flex-1 text-gray-500 pl-2"></span>
            <span className="w-8 text-center">{fmtQty(item.qty)}</span>
            <span className="w-12 text-right">{fmt(item.rate)}</span>
            <span className="w-8 text-right">{fmt(item.vat)}</span>
            <span className="w-14 text-right font-semibold">{fmt(Number(item.total) + Number(item.vat))}</span>
          </div>
        </div>
      ))}

      <div className="border-t border-dashed border-black my-1.5" />

      {/* ── Summary ── */}
      <div className="text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span>Total Amount</span>
          <span>৳ {fmt(totalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>VAT Amount</span>
          <span>৳ {fmt(vatAmount)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Discount ({fmt(discountPercent)}%)</span>
            <span>- ৳ {fmt(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold border-t border-dashed border-black pt-0.5 mt-0.5">
          <span>Total Payable</span>
          <span>৳ {fmt(payableAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid Amount</span>
          <span>৳ {fmt(paidAmount)}</span>
        </div>
        <div className="flex justify-between font-bold text-red-600">
          <span>Change</span>
          <span>৳ {fmt(changeAmount)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      {/* ── Footer ── */}
      <div className="text-center text-[10px]">
        <div>Served By: <span className="font-semibold">{sale.servedBy}</span></div>
        <div className="mt-1">Thank you for visiting Khazana Mithai!</div>
        <div>We hope to see you again soon.</div>
        <div className="mt-1 text-gray-400">Software by: www.sprwforge.com</div>
      </div>

      <div className="border-t border-dashed border-black mt-2" />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<PosSale | null>(null);
  const user = useAuthStore((s) => s.user);
  /**
   * The terminal opens this page with ?print=1 straight after a sale, so the
   * format has to be right before anyone can touch it — the counter must never
   * have to pick one before the customer's copy comes out of the printer.
   *
   * The factory bills on the A4 corporate invoice; a shop till prints the 80mm
   * receipt. Null until the session is known, because the wrong default would
   * be printed, not merely displayed.
   */
  const [format, setFormat] = useState<InvoiceFormat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Only ever seeds the default: once it is set, a manual switch stands and
    // a later store update must not pull the format back from under the user.
    setFormat((chosen) => chosen ?? (isFactoryBranch(user) ? "corporate" : "thermal"));
  }, [user]);

  useEffect(() => {
    posSalesApi
      .getOne(id)
      .then(setSale)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-open the print dialog when launched from the POS terminal
  // (window.open(`/pos/invoice/${id}?print=1`, "_blank")). Reading from
  // window.location avoids needing a Suspense boundary for useSearchParams.
  useEffect(() => {
    if (!sale || !format) return;
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 300); // let the document paint first
    return () => clearTimeout(t);
  }, [sale, format]);

  const handlePrint = () => window.print();

  // Error first: a failed fetch must reach the message below even if the
  // session never resolved a format.
  if (!error && (loading || !format)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100">
        <div className="text-gray-400 text-sm">Loading invoice...</div>
      </div>
    );
  }

  if (error || !sale || !format) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100">
        <div className="text-center">
          <p className="text-gray-500 mb-3">Invoice not found.</p>
          <button
            onClick={() => router.push("/pos")}
            className="text-primary-700 underline text-sm"
          >
            Back to POS
          </button>
        </div>
      </div>
    );
  }

  // The A4 documents read a credit-invoice shape; one adapter feeds both, so
  // the terminal's A4 invoice agrees with the credit-sale one figure for figure.
  const a4 = format === "thermal" ? null : posSaleToInvoice(sale);
  const heading = format === "challan" ? "Challan" : "Invoice";

  return (
    <>
      {/* ── Print styles ── The 80mm receipt is its own document (#receipt, its
          own rules); the A4 formats share the credit-sale print styles, which
          target #invoice. Only one is mounted at a time, so the two sets of
          rules can never both apply to one print. */}
      {format === "thermal" ? (
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #receipt, #receipt * { visibility: visible !important; }
            #receipt {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 80mm !important;
              margin: 0 !important;
              padding: 4mm !important;
              box-shadow: none !important;
            }
            .no-print { display: none !important; }
          }
        `}</style>
      ) : (
        <InvoicePrintStyles format={format} />
      )}

      {/* ── Screen wrapper ── */}
      <div className="min-h-screen bg-sage-200 flex flex-col">
        {/* Top bar (hidden on print) */}
        <div className="no-print bg-white border-b border-sage-300 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => router.push("/pos")}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5"
          >
            ← New Sale
          </button>
          <h1 className="font-semibold text-gray-800">{heading} — {sale.invoiceNo}</h1>

          <div className="flex items-center gap-3">
            {/* Format switch */}
            <div className="flex rounded-lg border border-sage-300 overflow-hidden text-sm">
              {([
                ["thermal", "POS Receipt"],
                ["corporate", "Corporate (A4)"],
                ["challan", "Challan (A4)"],
              ] as [InvoiceFormat, string][]).map(([value, label], i) => (
                <button
                  key={value}
                  onClick={() => setFormat(value)}
                  className={`px-3 py-1.5 font-medium transition-colors ${i > 0 ? "border-l border-sage-300" : ""} ${
                    format === value ? "bg-primary-700 text-white" : "bg-white text-gray-600 hover:bg-sage-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={handlePrint}
              className="bg-primary-800 hover:bg-primary-700 text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors"
            >
              🖨 Print
            </button>
          </div>
        </div>

        {/* Document preview */}
        <div className="flex-1 flex items-start justify-center py-10 overflow-x-auto">
          <div className="shadow-2xl rounded-sm">
            {!a4 ? (
              <Receipt sale={sale} />
            ) : format === "challan" ? (
              <CreditSaleChallan inv={a4} />
            ) : (
              <CorporateInvoice inv={a4} />
            )}
          </div>
        </div>

        {/* Sales history link */}
        <div className="no-print text-center pb-6">
          <button
            onClick={() => router.push("/pos/sales")}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            View all POS sales
          </button>
        </div>
      </div>
    </>
  );
}
