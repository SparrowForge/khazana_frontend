"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchVatCreditInvoice, type VatCreditInvoice } from "./server";
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
function ThermalInvoice({ inv }: { inv: VatCreditInvoice }) {
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
        <div className="flex justify-between"><span>Date:</span><span>{formatDate(inv.invoiceDate)}</span></div>
        <div className="flex justify-between"><span>Invoice:</span><span className="font-bold">{inv.invoiceNo}</span></div>
        <div className="flex justify-between"><span>Type:</span><span>VAT Credit Sale</span></div>
        {inv.poNo && <div className="flex justify-between"><span>PO No:</span><span>{inv.poNo}</span></div>}
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-[10px]">
        <div className="font-bold">CUSTOMER</div>
        <div>{inv.customer?.name ?? "—"}</div>
        {inv.customer?.code && <div>Code: {inv.customer.code}</div>}
        <div>Contact: {inv.customer?.mobile || "—"}</div>
        {inv.customer?.address && <div>{inv.customer.address}</div>}
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

      <div className="text-[10px] space-y-0.5">
        <div className="flex justify-between"><span>Sub-total</span><span>৳ {fmt(inv.totalAmount)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>৳ {fmt(inv.totalDiscount)}</span></div>
        <div className="flex justify-between"><span>Net Amount</span><span>৳ {fmt(inv.netAmount)}</span></div>
        <div className="flex justify-between"><span>VAT Amount</span><span>৳ {fmt(inv.totalVat)}</span></div>
        <div className="flex justify-between font-bold border-t border-dashed border-black pt-0.5 mt-0.5">
          <span>Total Payable</span>
          <span>৳ {fmt(inv.payableAmount)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-center text-[10px]">
        <div className="font-bold tracking-wider mb-0.5">TREASURE OF GOURMET SWEETS</div>
        {inv.invoiceBy && <div>Invoiced By: <span className="font-semibold">{inv.invoiceBy}</span></div>}
        <div className="mt-1">Thank you for your business!</div>
        <div className="mt-1 text-gray-400">Software by: www.sprwforge.com</div>
      </div>

      <div className="border-t border-dashed border-black mt-2" />
    </div>
  );
}

// ── Format 2: corporate A4 tax invoice (Mushak 6.3) ──────────
function CorporateInvoice({ inv }: { inv: VatCreditInvoice }) {
  return (
    <div
      id="invoice"
      className="bg-white text-black mx-auto p-10 text-[12px] leading-relaxed"
      style={{ width: "210mm", minHeight: "297mm" }}
    >
      {/* Letterhead */}
      <div className="text-center border-b-2 border-black pb-3">
        <div className="text-2xl font-bold tracking-wide">KHAZANA MITHAI</div>
        <div className="text-[11px] text-gray-700">Treasure of Gourmet Sweets</div>
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
          TAX INVOICE
        </span>
      </div>

      {/* Bill To + invoice meta */}
      <div className="flex justify-between gap-8 mb-5">
        <div className="flex-1">
          <div className="font-bold border-b border-gray-300 mb-1 pb-0.5">Bill To</div>
          <div className="font-semibold">{inv.customer?.name ?? "—"}</div>
          {inv.customer?.code && <div className="text-gray-600">Customer Code: {inv.customer.code}</div>}
          {inv.customer?.address && <div className="text-gray-600">{inv.customer.address}</div>}
          <div className="text-gray-600">Contact No: {inv.customer?.mobile || "—"}</div>
        </div>
        <div className="w-64">
          <div className="font-bold border-b border-gray-300 mb-1 pb-0.5">Invoice Details</div>
          <div className="flex justify-between"><span className="text-gray-600">Invoice No:</span><span className="font-semibold">{inv.invoiceNo}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Invoice Date:</span><span>{formatDate(inv.invoiceDate)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">PO No:</span><span>{inv.poNo || "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Sale Type:</span><span>VAT Credit</span></div>
        </div>
      </div>

      {/* Lines */}
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-gray-100">
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
            <span className="text-gray-600">Discount</span><span>৳ {fmt(inv.totalDiscount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Net Amount</span><span>৳ {fmt(inv.netAmount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">VAT Amount</span><span>৳ {fmt(inv.totalVat)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-black mt-1 pt-1 font-bold text-sm">
            <span>Total Payable</span><span>৳ {fmt(inv.payableAmount)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 border border-gray-400 px-3 py-2 text-[11px]">
        <span className="font-semibold">In Words: </span>
        {amountInWords(inv.payableAmount)}
      </div>

      {/* Signatures */}
      <div className="flex justify-between mt-20 text-[11px]">
        <div className="text-center">
          <div className="border-t border-black w-48 pt-1">
            Prepared By{inv.invoiceBy ? ` — ${inv.invoiceBy}` : ""}
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
        This is a computer-generated tax invoice. · Software by www.sprwforge.com
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function VatCreditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<VatCreditInvoice | null>(null);
  const [format, setFormat] = useState<Format>("thermal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchVatCreditInvoice(id)
      .then(setInv)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading invoice…</div>
      </div>
    );
  }

  if (error || !inv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-3">VAT credit sale invoice not found.</p>
          <button onClick={() => router.push("/sales/vat/credit")} className="text-primary-700 underline text-sm">
            Back to VAT Credit Sale
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

      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="no-print bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => router.push("/sales/vat/credit")}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← Back to VAT Credit Sale
          </button>

          <h1 className="font-semibold text-gray-800">VAT Credit Invoice — {inv.invoiceNo}</h1>

          <div className="flex items-center gap-3">
            {/* Format switch */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                onClick={() => setFormat("thermal")}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  format === "thermal" ? "bg-primary-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                POS Receipt
              </button>
              <button
                onClick={() => setFormat("corporate")}
                className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-200 ${
                  format === "corporate" ? "bg-primary-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
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
