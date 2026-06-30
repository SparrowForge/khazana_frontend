"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { posSalesApi, type PosSale } from "@/lib/services/pos.service";

// ── Helpers ─────────────────────────────────────────────────
const fmt = (n: number | string) => Number(n).toFixed(2);

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
            <span className="w-8 text-center">{Number(item.qty).toFixed(0)}</span>
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
        <div className="font-bold tracking-wider mb-0.5">TREASURE OF GOURMET SWEETS</div>
        <div>Served By: <span className="font-semibold">{sale.servedBy}</span></div>
        <div className="mt-1">Thank you for visiting Khazana Mithai!</div>
        <div>We hope to see you again soon.</div>
        <div className="mt-1 text-gray-400">Software by: https://sprwforge.com</div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
    if (!sale) return;
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 300); // let the receipt paint first
    return () => clearTimeout(t);
  }, [sale]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading invoice...</div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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

  return (
    <>
      {/* ── Print styles ── */}
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

      {/* ── Screen wrapper ── */}
      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Top bar (hidden on print) */}
        <div className="no-print bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/pos")}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5"
          >
            ← New Sale
          </button>
          <h1 className="font-semibold text-gray-800">Invoice — {sale.invoiceNo}</h1>
          <button
            onClick={handlePrint}
            className="bg-primary-800 hover:bg-primary-700 text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors"
          >
            🖨 Print
          </button>
        </div>

        {/* Receipt preview */}
        <div className="flex-1 flex items-start justify-center py-10">
          <div className="shadow-2xl rounded-sm">
            <Receipt sale={sale} />
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
