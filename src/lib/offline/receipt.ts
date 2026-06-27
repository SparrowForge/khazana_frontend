// Self-contained offline receipt printing. When offline we can't route to
// /pos/invoice/[id] (no server id yet), so we open a blank window and write a
// standalone receipt built from the locally-stored display snapshot. Mirrors the
// online <Receipt> layout closely enough for a thermal print.

import type { OfflineOrder } from "./offlineStore";

const fmt = (n: number) => Number(n).toFixed(2);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function printOfflineReceipt(order: OfflineOrder): void {
  if (typeof window === "undefined") return;
  const d = order.display;
  const w = window.open("", "_blank", "width=360,height=640");
  if (!w) return; // popup blocked — caller already toasts the invoice number

  const rows = d.lines
    .map(
      (l) => `
      <div class="item">${esc(l.name)}</div>
      <div class="row">
        <span class="qty">${l.qty}</span>
        <span class="rate">${fmt(l.rate)}</span>
        <span class="vat">${fmt(l.vat)}</span>
        <span class="tot">${fmt(l.total + l.vat)}</span>
      </div>`,
    )
    .join("");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
  <title>${esc(order.invoiceNo)}</title>
  <style>
    @page { margin: 0; }
    body { font-family: 'Courier New', monospace; font-size: 11px; color:#000; width:302px; margin:0 auto; padding:12px; }
    .center { text-align:center; }
    .bold { font-weight:bold; }
    .big { font-size:14px; letter-spacing:2px; }
    .hr { border-top:1px dashed #000; margin:6px 0; }
    .meta, .sum { font-size:10px; }
    .kv { display:flex; justify-content:space-between; }
    .head { display:flex; font-size:10px; font-weight:bold; }
    .row { display:flex; font-size:10px; margin-bottom:2px; }
    .head span, .row span { display:inline-block; }
    .qty { width:30px; text-align:center; } .rate { flex:1; text-align:right; }
    .vat { width:38px; text-align:right; } .tot { width:56px; text-align:right; font-weight:600; }
    .item { font-size:10px; }
    .offline { background:#000; color:#fff; text-align:center; padding:2px; font-size:10px; margin-top:4px; }
  </style></head><body>
    <div class="center">
      <div class="bold big">KHAZANA MITHAI</div>
      <div>Gulshan-1, Dhaka-1212</div>
      <div>Tel: +880 1700-000000</div>
    </div>
    <div class="hr"></div>
    <div class="meta">
      <div class="kv"><span>Date:</span><span>${esc(d.dateTime)}</span></div>
      <div class="kv"><span>Invoice:</span><span class="bold">${esc(order.invoiceNo)}</span></div>
      <div class="kv"><span>Type:</span><span>${esc(order.salesType ?? "Cash")}</span></div>
    </div>
    <div class="offline">OFFLINE SALE — pending sync</div>
    <div class="hr"></div>
    <div class="head"><span style="flex:1">ITEM</span><span class="qty">QTY</span><span class="rate">RATE</span><span class="vat">VAT</span><span class="tot">TOTAL</span></div>
    <div class="hr"></div>
    ${rows}
    <div class="hr"></div>
    <div class="sum">
      <div class="kv"><span>Sub-total</span><span>৳ ${fmt(d.subtotal)}</span></div>
      <div class="kv"><span>VAT</span><span>৳ ${fmt(d.vatAmount)}</span></div>
      ${d.discountAmount > 0 ? `<div class="kv"><span>Discount</span><span>-৳ ${fmt(d.discountAmount)}</span></div>` : ""}
      <div class="kv bold"><span>Payable</span><span>৳ ${fmt(d.payableAmount)}</span></div>
      <div class="kv"><span>Paid</span><span>৳ ${fmt(d.paidAmount)}</span></div>
      <div class="kv bold"><span>Change</span><span>৳ ${fmt(d.changeAmount)}</span></div>
    </div>
    <div class="hr"></div>
    <div class="center">
      <div>Served By: ${esc(d.servedBy || "-")}</div>
      <div>Thank you for visiting!</div>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
  </body></html>`);
  w.document.close();
}
