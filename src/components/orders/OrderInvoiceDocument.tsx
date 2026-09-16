"use client";

import { amountInWords } from "@/lib/utils";
import type { OrderInvoiceData } from "@/lib/export/orderInvoiceDocument";
import { formatInvoiceDate } from "@/components/sales/CreditInvoiceDocument";

// The A4 advance-order document — the same corporate letterhead, Bill To /
// meta grid, item table and bottom-anchored signature footer as the Credit
// Sales corporate invoice, so the two printed papers read as one family. An
// order has no Paid/Due in the credit-sale sense; Advance and Total Due
// stand in for those instead.

const fmt = (n: number | string) => Number(n).toFixed(2);
const fmtQty = (n: number | string) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};
const fmtPct = (n: number | string) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
};

/** A labelled delivery instruction on the sheet. Blank prints as a rule rather
 *  than a dash: an order is often taken before the address or the note is
 *  settled, and the paper travels with the goods. */
function DeliveryField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-end gap-2 text-[11px]">
      <span className="text-gray-600 shrink-0">{label}:</span>
      <span className={`flex-1 border-b border-dotted border-gray-500 min-h-[1.15em] ${value ? "font-medium" : ""}`}>
        {value || ""}
      </span>
    </div>
  );
}

export function OrderCorporateInvoice({ inv }: { inv: OrderInvoiceData }) {
  return (
    <div
      id="invoice"
      className="bg-white text-black mx-auto p-10 text-[12px] leading-relaxed flex flex-col"
      style={{ width: "210mm", minHeight: "297mm" }}
    >
      {/* Letterhead */}
      <div className="text-center border-b-2 border-black pb-3">
        <div className="text-2xl font-bold tracking-wide">KHAZANA MITHAI</div>
        <div className="text-[11px] mt-1">
          {inv.branchName ? `${inv.branchName} Branch — ` : ""}
          {inv.branchAddress || ""}
        </div>
        <div className="text-[11px]">
          VAT Reg No: {inv.branchVatNo || "—"}
          {inv.branchMobile ? ` · Tel: ${inv.branchMobile}` : ""}
        </div>
      </div>

      <div className="text-center my-4">
        <span className="inline-block border border-black px-6 py-1 text-sm font-bold tracking-widest">
          ADVANCE ORDER
        </span>
      </div>

      {/* Deliver To + order meta */}
      <div className="flex justify-between gap-8 mb-3">
        <div className="flex-1">
          <div className="font-bold border-b border-sage-400 mb-1 pb-0.5">Deliver To</div>
          <div className="font-semibold">{inv.customerName}</div>
        </div>
        <div className="w-64">
          <div className="font-bold border-b border-sage-400 mb-1 pb-0.5">Order Details</div>
          <div className="flex justify-between"><span className="text-gray-600">Order No:</span><span className="font-semibold">{inv.serialNo}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Order Date:</span><span>{formatInvoiceDate(String(inv.orderDate))}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Delivery Date:</span><span>{inv.deliveryDate ? formatInvoiceDate(String(inv.deliveryDate)) : "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Delivery Time:</span><span>{inv.deliveryTime || "—"}</span></div>
        </div>
      </div>

      {/* Delivery instructions. Full width rather than tucked under the
          customer name — the driver reads these, and an address folded into a
          third of the sheet wraps to four lines. An unfilled field prints a
          rule to write on, so the paper works for an order taken before the
          details were settled. */}
      <div className="mb-5 space-y-1.5">
        <DeliveryField label="Delivery Address" value={inv.deliveryAddress} />
        <DeliveryField label="Remarks" value={inv.remarks} />
      </div>

      {/* Lines */}
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-sage-200">
            <th className="border border-gray-400 px-2 py-1.5 text-left w-8">#</th>
            <th className="border border-gray-400 px-2 py-1.5 text-left">Description</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right w-24">Qty</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right w-24">Rate</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right w-24">VAT</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, i) => (
            <tr key={i}>
              <td className="border border-gray-400 px-2 py-1.5">{i + 1}</td>
              <td className="border border-gray-400 px-2 py-1.5">{item.itemName}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right">{fmtQty(item.qty)}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right">{fmt(item.rate)}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right">{fmt(item.vat)}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right font-medium">{fmt(item.total + item.vat)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mt-4">
        <div className="w-72 text-[12px]">
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Total Amount</span><span>৳ {fmt(inv.totalAmount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">VAT Amount</span><span>৳ {fmt(inv.vatAmount)}</span>
          </div>
          {inv.discountAmount > 0 && (
            <div className="flex justify-between py-0.5">
              <span className="text-gray-600">Discount ({fmtPct(inv.discountPercent)}%)</span>
              <span>- ৳ {fmt(inv.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-black mt-1 pt-1 font-bold text-sm">
            <span>Total Payable</span><span>৳ {fmt(inv.totalPayable)}</span>
          </div>
          {inv.advance > 0 && (
            <div className="flex justify-between py-0.5">
              <span className="text-gray-600">Advance</span><span>৳ {fmt(inv.advance)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-red-600">
            <span>Total Due</span><span>৳ {fmt(inv.totalDue)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 border border-gray-400 px-3 py-2 text-[11px]">
        <span className="font-semibold">In Words: </span>
        {amountInWords(inv.totalPayable)}
      </div>

      {/* Page footer: same bottom-anchored signature block as the credit sale
          documents, so every printed paper signs on the same line. */}
      <div className="mt-auto pt-16">
        <div className="flex justify-between text-[11px]">
          <div className="text-center">
            <div className="border-t border-black w-48 pt-1">
              Prepared By{inv.servedBy ? ` — ${inv.servedBy}` : ""}
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black w-48 pt-1">Received By</div>
          </div>
          <div className="text-center">
            <div className="border-t border-black w-48 pt-1">Authorised Signature</div>
          </div>
        </div>

        <div className="text-center text-[10px] text-gray-400 mt-6">
          This is a computer-generated document. · Software by www.sprwforge.com
        </div>
      </div>
    </div>
  );
}
