// Order invoice — a khazana-branded receipt document matching the POS
// terminal's printed invoice layout (pos/invoice/[id]/page.tsx's Receipt
// component), so an order and a POS sale produce the same-looking paperwork.
// Unlike a POS sale, an order has no "paid amount" or "change" — instead it
// carries an optional advance and a resulting due balance.

export interface OrderInvoiceLine {
  itemName: string;
  qty: number;
  rate: number;
  vat: number;
  total: number;
}

export interface OrderInvoiceData {
  branchName?: string;
  branchAddress?: string;
  branchVatNo?: string;
  branchMobile?: string;
  orderDate: string | Date;
  serialNo: string;
  customerName: string;
  servedBy?: string;
  items: OrderInvoiceLine[];
  totalAmount: number;
  vatAmount: number;
  discountPercent: number;
  discountAmount: number;
  totalPayable: number;
  advance: number;
  totalDue: number;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n: number) => Number(n || 0).toFixed(2);
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : Number(n || 0).toFixed(2));

export function formatInvoiceDateTime(value: string | Date): string {
  const d = new Date(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${h}:${min} ${ampm}`;
}

function itemRowsHtml(items: OrderInvoiceLine[]) {
  return items
    .map(
      (it) => `
    <div class="item-name">${esc(it.itemName)}</div>
    <div class="item-row">
      <span class="flex-1"></span>
      <span class="w8 center">${esc(fmtQty(it.qty))}</span>
      <span class="w12 right">${esc(fmt(it.rate))}</span>
      <span class="w8 right">${esc(fmt(it.vat))}</span>
      <span class="w14 right bold">${esc(fmt(it.total))}</span>
    </div>`,
    )
    .join("");
}

function buildOrderInvoiceDocument(data: OrderInvoiceData, autoPrint: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8">
  <title>Order Invoice — ${esc(data.serialNo)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color:#111; margin:0; }
    .receipt { width: 280px; margin: 0 auto; padding: 10px 4px; }
    .center { text-align:center; }
    .bold { font-weight:700; }
    .small { font-size:10px; }
    .dashed { border-top:1px dashed #000; margin: 6px 0; }
    .row { display:flex; justify-content:space-between; }
    .flex-1 { flex:1; }
    .w8 { width:28px; }
    .w12 { width:42px; }
    .w14 { width:50px; }
    .w8.center { text-align:center; }
    .right { text-align:right; }
    .item-name { font-size:10px; font-weight:500; }
    .item-row { display:flex; font-size:10px; margin-bottom:3px; }
    .col-head { display:flex; font-size:10px; font-weight:700; }
    .due { color:#c0392b; }
  </style></head><body>
  <div class="receipt">
    <div class="center bold" style="font-size:14px; letter-spacing:2px;">KHAZANA MITHAI</div>
    <div class="center small">${esc(data.branchName)} Branch</div>
    <div class="center small">${esc(data.branchAddress)}</div>
    <div class="center small">VAT Reg No: ${esc(data.branchVatNo || "—")}</div>
    <div class="center small">[Mushak 6.3]</div>
    <div class="center small">Tel: ${esc(data.branchMobile || "—")}</div>
    <div class="center small">www.khazanamithai.com</div>
    <div class="dashed"></div>
    <div class="row small"><span>Date:</span><span>${esc(formatInvoiceDateTime(data.orderDate))}</span></div>
    <div class="row small"><span>Invoice:</span><span class="bold">${esc(data.serialNo)}</span></div>
    <div class="row small"><span>Customer:</span><span>${esc(data.customerName)}</span></div>
    <div class="dashed"></div>
    <div class="col-head">
      <span class="flex-1">ITEM</span>
      <span class="w8 center">QTY</span>
      <span class="w12 right">RATE</span>
      <span class="w8 right">VAT</span>
      <span class="w14 right">TOTAL</span>
    </div>
    <div class="dashed" style="margin:4px 0;"></div>
    ${itemRowsHtml(data.items)}
    <div class="dashed"></div>
    <div class="row small"><span>Total Amount</span><span>৳ ${fmt(data.totalAmount)}</span></div>
    <div class="row small"><span>VAT Amount</span><span>৳ ${fmt(data.vatAmount)}</span></div>
    ${
      data.discountAmount > 0
        ? `<div class="row small"><span>Discount (${fmt(data.discountPercent)}%)</span><span>- ৳ ${fmt(data.discountAmount)}</span></div>`
        : ""
    }
    <div class="row bold small" style="border-top:1px dashed #000; padding-top:3px; margin-top:3px;"><span>Total Payable</span><span>৳ ${fmt(data.totalPayable)}</span></div>
    ${
      data.advance > 0
        ? `<div class="row small"><span>Advance</span><span>৳ ${fmt(data.advance)}</span></div>`
        : ""
    }
    <div class="row bold small due"><span>Total Due</span><span>৳ ${fmt(data.totalDue)}</span></div>
    <div class="dashed"></div>
    <div class="center small">
      <div class="bold" style="letter-spacing:1px;">TREASURE OF GOURMET SWEETS</div>
      ${data.servedBy ? `<div>Served By: <span class="bold">${esc(data.servedBy)}</span></div>` : ""}
      <div style="margin-top:4px;">Thank you for visiting Khazana Mithai!</div>
      <div>We hope to see you again soon.</div>
      <div style="margin-top:4px; color:#999;">Software by: www.sprwforge.com</div>
    </div>
    <div class="dashed" style="margin-top:8px;"></div>
  </div>
  ${autoPrint ? `<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>` : ""}
  </body></html>`;
}

/** Opens the invoice in a new tab without triggering the print dialog. */
export function previewOrderInvoice(data: OrderInvoiceData): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return; // popup blocked — caller surfaces the toast
  w.document.write(buildOrderInvoiceDocument(data, false));
  w.document.close();
}

/** Opens the invoice in a new tab and triggers the print dialog once it paints. */
export function printOrderInvoice(data: OrderInvoiceData): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(buildOrderInvoiceDocument(data, true));
  w.document.close();
}

/** Download a real .pdf laid out like the invoice (letterhead + item table + totals). */
export async function exportOrderInvoicePdf(data: OrderInvoiceData): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const rightX = pageWidth - 40;

  doc.setFontSize(16);
  doc.text("KHAZANA MITHAI", centerX, 50, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(90);
  let y = 68;
  const headerLines = [
    data.branchName ? `${data.branchName} Branch` : undefined,
    data.branchAddress,
    `VAT Reg No: ${data.branchVatNo || "—"}`,
    data.branchMobile ? `Tel: ${data.branchMobile}` : undefined,
  ].filter((l): l is string => !!l);
  for (const line of headerLines) {
    doc.text(line, centerX, y, { align: "center" });
    y += 14;
  }
  doc.setTextColor(0);

  y += 10;
  doc.setFontSize(10);
  doc.text(`Date: ${formatInvoiceDateTime(data.orderDate)}`, 40, y);
  doc.text(`Invoice: ${data.serialNo}`, centerX, y, { align: "center" });
  doc.text(`Customer: ${data.customerName}`, rightX, y, { align: "right" });
  y += 18;

  autoTable(doc, {
    startY: y,
    head: [["Item", "Qty", "Rate", "VAT", "Total"]],
    body: data.items.map((it) => [it.itemName, fmtQty(it.qty), fmt(it.rate), fmt(it.vat), fmt(it.total)]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [51, 51, 51], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  let sy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  const summaryLine = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, 400, sy);
    doc.text(value, rightX, sy, { align: "right" });
    sy += 16;
  };
  summaryLine("Total Amount", `৳ ${fmt(data.totalAmount)}`);
  summaryLine("VAT Amount", `৳ ${fmt(data.vatAmount)}`);
  if (data.discountAmount > 0) summaryLine(`Discount (${fmt(data.discountPercent)}%)`, `- ৳ ${fmt(data.discountAmount)}`);
  summaryLine("Total Payable", `৳ ${fmt(data.totalPayable)}`, true);
  if (data.advance > 0) summaryLine("Advance", `৳ ${fmt(data.advance)}`);
  summaryLine("Total Due", `৳ ${fmt(data.totalDue)}`, true);
  doc.setFont("helvetica", "normal");

  doc.save(`Order_Invoice_${data.serialNo}.pdf`);
}
