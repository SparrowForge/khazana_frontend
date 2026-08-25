"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchNcInvoice, type NcInvoice } from "./server";
import { amountInWords } from "@/lib/utils";

// ── Helpers ─────────────────────────────────────────────────
const fmt = (n: number | string) => Number(n).toFixed(2);
/** Qty may be fractional (weight-priced items) — never round it away. */
const fmtQty = (n: number | string) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

type Format = "thermal" | "corporate";

// ── Format 1: same 80mm receipt the POS terminal prints ──────
function ThermalInvoice({ inv }: { inv: NcInvoice }) {
  return (
    <div
      id="invoice"
      className="font-mono text-[11px] leading-[1.55] text-black bg-white w-[302px] px-3 py-4 mx-auto"
      style={{ fontFamily: "'Courier New', Courier, monospace" }}
    >
      <div className="text-center mb-1">
        <div className="font-bold text-[14px] tracking-widest">KHAZANA MITHAI</div>
        <div className="text-[10px]">{inv.branch?.name} Branch</div>
        <div className="text-[10px]">{inv.branch?.address}</div>
        <div className="text-[10px]">VAT Reg No: {inv.branch?.vatNo || "—"}</div>
        <div className="text-[10px]">[Mushak 6.3]</div>
        <div className="text-[10px]">Tel: {inv.branch?.mobileNo || "—"}</div>
        <div className="text-[10px]">www.khazanamithai.com</div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-[10px]">
        <div className="flex justify-between"><span>Date:</span><span>{formatDate(inv.ncDate)}</span></div>
        <div className="flex justify-between"><span>NC No:</span><span className="font-bold">{inv.ncCode || "—"}</span></div>
        <div className="flex justify-between"><span>Type:</span><span>NC Adjustment</span></div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      {/* The NC's attribution stands where a sale prints its customer. */}
      <div className="text-[10px]">
        <div className="font-bold">ISSUED TO</div>
        <div>{inv.name || "—"}</div>
        <div>Contact: {inv.contactNo || "—"}</div>
        <div>Ref: {inv.reference || "—"}</div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="flex text-[10px] font-bold">
        <span className="flex-1">ITEM</span>
        <span className="w-8 text-center">QTY</span>
        <span className="w-12 text-right">RATE</span>
        <span className="w-8 text-right">VAT</span>
        <span className="w-14 text-right">TOTAL</span>
      </div>

      <div className="border-t border-dashed border-black my-1" />

      {inv.items.map((item, i) => (
        <div key={i}>
          <div className="text-[10px] font-medium truncate">{item.itemName || item.itemCode}</div>
          <div className="flex text-[10px] mb-0.5">
            <span className="flex-1" />
            <span className="w-8 text-center">{fmtQty(item.quantity)}</span>
            <span className="w-12 text-right">{fmt(item.rate)}</span>
            <span className="w-8 text-right">{fmt(item.vat)}</span>
            <span className="w-14 text-right font-semibold">{fmt(item.total + item.vat)}</span>
          </div>
        </div>
      ))}

      <div className="border-t border-dashed border-black my-1.5" />

      {/* Same summary block as the POS receipt, except an NC collects nothing —
          the bold line is the value of the goods issued, not an amount payable. */}
      <div className="text-[10px] space-y-0.5">
        <div className="flex justify-between"><span>Total Amount</span><span>৳ {fmt(inv.netAmount)}</span></div>
        <div className="flex justify-between"><span>VAT Amount</span><span>৳ {fmt(inv.totalVat)}</span></div>
        {Number(inv.totalDiscount) > 0 && (
          <div className="flex justify-between"><span>Item Discount</span><span>- ৳ {fmt(inv.totalDiscount)}</span></div>
        )}
        <div className="flex justify-between font-bold border-t border-dashed border-black pt-0.5 mt-0.5">
          <span>Total Value</span>
          <span>৳ {fmt(inv.grossAmount)}</span>
        </div>
        <div className="flex justify-between"><span>Paid Amount</span><span>৳ 0.00</span></div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-center text-[10px] font-bold tracking-wider">
        NON-CHARGE — NOT A SALE
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-center text-[10px]">       
        {inv.issuedBy && <div>Issued By: <span className="font-semibold">{inv.issuedBy}</span></div>}
        <div className="mt-1">Thank you for visiting Khazana Mithai!</div>
        <div className="mt-1 text-gray-400">Software by: www.sprwforge.com</div>
      </div>

      <div className="border-t border-dashed border-black mt-2" />
    </div>
  );
}

// ── Format 2: corporate A4 sheet ─────────────────────────────
function CorporateInvoice({ inv }: { inv: NcInvoice }) {
  return (
    <div
      id="invoice"
      className="bg-white text-black mx-auto p-10 text-[12px] leading-relaxed"
      style={{ width: "210mm", minHeight: "297mm" }}
    >
      {/* Letterhead */}
      <div className="text-center border-b-2 border-black pb-3">
        <div className="text-2xl font-bold tracking-wide">KHAZANA MITHAI</div>
        <div className="text-[11px] mt-1">
          {inv.branch?.name ? `${inv.branch.name} Branch — ` : ""}
          {inv.branch?.address || ""}
        </div>
        <div className="text-[11px]">
          VAT Reg No: {inv.branch?.vatNo || "—"}
          {inv.branch?.mobileNo ? ` · Tel: ${inv.branch.mobileNo}` : ""}
        </div>
        <div className="text-[11px] font-semibold">[Mushak 6.3]</div>
      </div>

      <div className="text-center my-4">
        <span className="inline-block border border-black px-6 py-1 text-sm font-bold tracking-widest">
          NC ADJUSTMENT INVOICE
        </span>
      </div>

      {/* Issued to + NC meta */}
      <div className="flex justify-between gap-8 mb-5">
        <div className="flex-1">
          <div className="font-bold border-b border-sage-400 mb-1 pb-0.5">Issued To</div>
          <div className="font-semibold">{inv.name || "—"}</div>
          <div className="text-gray-600">Contact No: {inv.contactNo || "—"}</div>
          <div className="text-gray-600">Reference: {inv.reference || "—"}</div>
        </div>
        <div className="w-64">
          <div className="font-bold border-b border-sage-400 mb-1 pb-0.5">NC Details</div>
          <div className="flex justify-between"><span className="text-gray-600">NC No:</span><span className="font-semibold">{inv.ncCode || "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">NC Date:</span><span>{formatDate(inv.ncDate)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Type:</span><span>Non-Charge</span></div>
        </div>
      </div>

      {/* Lines */}
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-sage-200">
            <th className="border border-gray-400 px-2 py-1.5 text-left w-8">#</th>
            <th className="border border-gray-400 px-2 py-1.5 text-left">Description</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right w-20">Qty</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right w-24">Rate</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right w-24">Discount</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right w-24">VAT</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, i) => (
            <tr key={i}>
              <td className="border border-gray-400 px-2 py-1.5">{i + 1}</td>
              <td className="border border-gray-400 px-2 py-1.5">
                {item.itemName || item.itemCode}
                {item.itemCode && <span className="text-gray-500"> ({item.itemCode})</span>}
              </td>
              <td className="border border-gray-400 px-2 py-1.5 text-right">
                {fmtQty(item.quantity)}{item.uom ? ` ${item.uom}` : ""}
              </td>
              <td className="border border-gray-400 px-2 py-1.5 text-right">{fmt(item.rate)}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right">{fmt(item.discount)}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right">{fmt(item.vat)}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right font-medium">
                {fmt(item.total + item.vat)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mt-4">
        <div className="w-72 text-[12px]">
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Sub-total</span><span>৳ {fmt(inv.totalAmount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Item Discount</span><span>৳ {fmt(inv.totalDiscount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Net Amount</span><span>৳ {fmt(inv.netAmount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">VAT Amount</span><span>৳ {fmt(inv.totalVat)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-black mt-1 pt-1 font-bold text-sm">
            <span>Total Value</span><span>৳ {fmt(inv.grossAmount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Amount Charged</span><span>৳ 0.00</span>
          </div>
        </div>
      </div>

      <div className="mt-4 border border-gray-400 px-3 py-2 text-[11px]">
        <span className="font-semibold">In Words: </span>
        {amountInWords(inv.grossAmount)}
      </div>

      <div className="mt-2 text-[11px] font-semibold">
        Non-charge issue — no payment is collected against this document.
      </div>

      {/* Signatures */}
      <div className="flex justify-between mt-20 text-[11px]">
        <div className="text-center">
          <div className="border-t border-black w-48 pt-1">
            Issued By{inv.issuedBy ? ` — ${inv.issuedBy}` : ""}
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-black w-48 pt-1">Received By</div>
        </div>
        <div className="text-center">
          <div className="border-t border-black w-48 pt-1">Authorised Signature</div>
        </div>
      </div>

      <div className="text-center text-[10px] text-gray-400 mt-10">
        This is a computer-generated document. · Software by www.sprwforge.com
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function NcInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<NcInvoice | null>(null);
  const [format, setFormat] = useState<Format>("thermal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchNcInvoice(id)
      .then(setInv)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-open the print dialog when opened with ?print=1 (how the NC entry page
  // hands off after a save). Reading from window.location avoids needing a
  // Suspense boundary for useSearchParams.
  useEffect(() => {
    if (!inv) return;
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 300); // let the receipt paint first
    return () => clearTimeout(t);
  }, [inv]);

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
          <p className="text-gray-500 mb-3">NC adjustment invoice not found.</p>
          <button onClick={() => router.push("/nc-adjustment/list")} className="text-primary-700 underline text-sm">
            Back to NC List
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page size follows the chosen format so the browser's print preview and
          "Save as PDF" both come out right (80mm roll vs A4 sheet). */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice, #invoice * { visibility: visible !important; }
          #invoice {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
        @page { size: ${format === "corporate" ? "A4 portrait" : "80mm auto"}; margin: ${format === "corporate" ? "10mm" : "0"}; }
      `}</style>

      <div className="min-h-screen bg-sage-200 flex flex-col">
        <div className="no-print bg-white border-b border-sage-300 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => router.push("/nc-adjustment/list")}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← Back to NC List
          </button>

          <h1 className="font-semibold text-gray-800">NC Invoice — {inv.ncCode || inv.id}</h1>

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
            </div>

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
            {format === "thermal" ? <ThermalInvoice inv={inv} /> : <CorporateInvoice inv={inv} />}
          </div>
        </div>
      </div>
    </>
  );
}
