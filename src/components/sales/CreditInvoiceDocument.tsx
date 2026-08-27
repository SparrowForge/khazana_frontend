"use client";

import { amountInWords } from "@/lib/utils";
import type { CreditInvoice } from "@/lib/invoice/creditInvoice";

// The printed credit-sale invoice, in both formats the business issues.
//
// Lives here rather than on the page because two pages render it: the internal
// one behind login, and the public link sent to the customer. A customer
// querying a figure must be looking at the same document the counter printed,
// so there is exactly one implementation of each format.

export type InvoiceFormat = "thermal" | "corporate";

// ── Helpers ─────────────────────────────────────────────────
const fmt = (n: number | string) => Number(n).toFixed(2);
/** Qty may be fractional (weight-priced items) — never round it away. */
const fmtQty = (n: number | string) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};
/** A discount rate reads as "5%", not "5.00%" — only show decimals when given. */
const fmtPct = (n: number | string) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
};

export function formatInvoiceDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// ── Format 1: same 80mm receipt the POS terminal prints ──────
export function ThermalInvoice({ inv }: { inv: CreditInvoice }) {
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
        <div className="flex justify-between"><span>Date:</span><span>{formatInvoiceDate(inv.invoiceDate)}</span></div>
        <div className="flex justify-between"><span>Invoice:</span><span className="font-bold">{inv.invoiceNo}</span></div>
        <div className="flex justify-between"><span>Type:</span><span>Credit Sale</span></div>
        {inv.poNo && <div className="flex justify-between"><span>PO No:</span><span>{inv.poNo}</span></div>}
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      {/* Address sits directly under the name — it is part of who the invoice is
          addressed to, not an afterthought below the phone number. */}
      <div className="text-[10px]">
        <div className="font-bold">CUSTOMER</div>
        <div>{inv.customer?.name ?? "—"}</div>
        {inv.customer?.address && <div>{inv.customer.address}</div>}
        {inv.customer?.code && <div>Code: {inv.customer.code}</div>}
        <div>Contact: {inv.customer?.mobile || "—"}</div>
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

      {/* Summary mirrors the POS terminal receipt, with Paid/Due standing in for
          the counter's Paid/Change. Paid is the linked order's advance, else 0. */}
      <div className="text-[10px] space-y-0.5">
        <div className="flex justify-between"><span>Total Amount</span><span>৳ {fmt(inv.totalAmount)}</span></div>
        <div className="flex justify-between"><span>VAT Amount</span><span>৳ {fmt(inv.totalVat)}</span></div>
        {Number(inv.lineDiscount) > 0 && (
          <div className="flex justify-between"><span>Item Discount</span><span>- ৳ {fmt(inv.lineDiscount)}</span></div>
        )}
        {/* The invoice-level discount is a % of the VAT-inclusive gross, so it
            is shown after VAT — the same order the POS receipt prints it in. */}
        {Number(inv.invoiceDiscount) > 0 && (
          <div className="flex justify-between">
            <span>Discount ({fmtPct(inv.discountPercent)}%)</span>
            <span>- ৳ {fmt(inv.invoiceDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold border-t border-dashed border-black pt-0.5 mt-0.5">
          <span>Total Payable</span>
          <span>৳ {fmt(inv.payableAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid Amount</span>
          <span>৳ {fmt(inv.paidAmount ?? 0)}</span>
        </div>
        <div className="flex justify-between font-bold text-red-600">
          <span>Due</span>
          <span>৳ {fmt(inv.dueAmount ?? inv.payableAmount)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-center text-[10px]">
        {inv.invoiceBy && <div>Invoiced By: <span className="font-semibold">{inv.invoiceBy}</span></div>}
        <div className="mt-1">Thank you for your business!</div>
        <div className="mt-1 text-gray-400">Software by: www.sprwforge.com</div>
      </div>

      <div className="border-t border-dashed border-black mt-2" />
    </div>
  );
}

// ── Format 2: corporate A4 invoice (Mushak 6.3) ──────────
export function CorporateInvoice({ inv }: { inv: CreditInvoice }) {
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
          INVOICE
        </span>
      </div>

      {/* Bill To + invoice meta */}
      <div className="flex justify-between gap-8 mb-5">
        <div className="flex-1">
          <div className="font-bold border-b border-sage-400 mb-1 pb-0.5">Bill To</div>
          <div className="font-semibold">{inv.customer?.name ?? "—"}</div>
          {inv.customer?.address && <div className="text-gray-600">{inv.customer.address}</div>}
          {inv.customer?.code && <div className="text-gray-600">Customer Code: {inv.customer.code}</div>}
          <div className="text-gray-600">Contact No: {inv.customer?.mobile || "—"}</div>
        </div>
        <div className="w-64">
          <div className="font-bold border-b border-sage-400 mb-1 pb-0.5">Invoice Details</div>
          <div className="flex justify-between"><span className="text-gray-600">Invoice No:</span><span className="font-semibold">{inv.invoiceNo}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Invoice Date:</span><span>{formatInvoiceDate(inv.invoiceDate)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">PO No:</span><span>{inv.poNo || "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Sale Type:</span><span>Credit</span></div>
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
            <span className="text-gray-600">Item Discount</span><span>৳ {fmt(inv.lineDiscount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Net Amount</span><span>৳ {fmt(inv.netAmount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">VAT Amount</span><span>৳ {fmt(inv.totalVat)}</span>
          </div>
          {/* Charged on the VAT-inclusive gross, so it lands after VAT — the
              same basis (and total) as the order this invoice bills. */}
          {Number(inv.invoiceDiscount) > 0 && (
            <>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-600">Gross Amount</span><span>৳ {fmt(inv.grossAmount)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-600">Discount ({fmtPct(inv.discountPercent)}%)</span>
                <span>- ৳ {fmt(inv.invoiceDiscount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t-2 border-black mt-1 pt-1 font-bold text-sm">
            <span>Total Payable</span><span>৳ {fmt(inv.payableAmount)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-600">Paid Amount</span><span>৳ {fmt(inv.paidAmount ?? 0)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Due</span><span>৳ {fmt(inv.dueAmount ?? inv.payableAmount)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 border border-gray-400 px-3 py-2 text-[11px]">
        <span className="font-semibold">In Words: </span>
        {amountInWords(inv.payableAmount)}
      </div>

      {/* Page footer: signatures sign on the same line of every invoice, short
          or long, because mt-auto drops this block to the foot of the sheet
          rather than letting it float up under the last table row. */}
      <div className="mt-auto pt-16">
        <div className="flex justify-between text-[11px]">
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

        <div className="text-center text-[10px] text-gray-400 mt-6">
          This is a computer-generated invoice. · Software by www.sprwforge.com
        </div>
      </div>
    </div>
  );
}

/** The print rules and page size for the chosen format, shared by both pages so
 *  "Save as PDF" comes out right (80mm roll vs A4 sheet) wherever it is used. */
export function InvoicePrintStyles({ format }: { format: InvoiceFormat }) {
  return (
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
        ${
          format === "corporate"
            ? `/* The sheet IS the page: @page contributes no margin of its own, so
                 the invoice's own p-10 padding is the margin. A 210mm x 297mm
                 sheet inside a 10mm page margin would overflow the 190mm x 277mm
                 box and carry the bottom-anchored signatures onto a second page.
                 296mm, not 297mm: at exactly the page height Chrome's rounding
                 tips the sheet over and emits a blank page after it. */
               #invoice { min-height: 296mm !important; }`
            : ""
        }
        .no-print { display: none !important; }
      }
      @page { size: ${format === "corporate" ? "A4 portrait" : "80mm auto"}; margin: 0; }
    `}</style>
  );
}
