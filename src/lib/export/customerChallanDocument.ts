// The customer-facing challan: an A4 sheet made out to a named party, listing
// what was delivered and nothing about what it cost.
//
// Distinct from deliveryChallanDocument.ts, which reproduces the pre-printed
// branch-to-branch pads (Delivery Challan / Goods Received Note / Vehicle
// Challan). Those are internal stock paperwork with a From/To branch heading and
// four role signature lines. This one is the document a customer signs for:
// Challan To / Challan Details, a Sl-Description-UOM-Qty-Remarks table, and a
// Name / Contact Number / Signature with Seal block for them to complete.

export interface CustomerChallanLine {
  itemName: string;
  uom?: string | null;
  qty: number;
}

export interface CustomerChallanData {
  companyName: string;
  /** Letterhead address — the issuing branch's own, falling back to the company's. */
  companyAddress?: string | null;
  vatNo?: string | null;
  mobileNo?: string | null;
  challanNo: string;
  challanDate: string | Date;
  /** Every field below is optional and prints its label with a blank value when
   *  absent — the sheet is meant to be completed by hand where the system has
   *  nothing to say. */
  customerName?: string | null;
  customerAddress?: string | null;
  contactPerson?: string | null;
  contactNo?: string | null;
  poNo?: string | null;
  poDate?: string | null;
  deliveryAddress?: string | null;
  items: CustomerChallanLine[];
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "27-Aug-2026". A bare "YYYY-MM-DD" is read as a plain calendar date — going
 *  through the local timezone would shift it a day either side of midnight. */
export function formatChallanDate(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** Quantities read as whole numbers where they are whole — "100", not "100.00". */
const qtyText = (n: number) => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2));

function buildDocument(data: CustomerChallanData, autoPrint: boolean): string {
  const rows = data.items
    .map(
      (line, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(line.itemName)}</td>
        <td class="c">${esc(line.uom ?? "")}</td>
        <td class="c">${esc(qtyText(line.qty))}</td>
        <td></td>
      </tr>`,
    )
    .join("");

  const total = data.items.reduce((sum, l) => sum + Number(l.qty || 0), 0);

  const autoPrintScript = autoPrint
    ? '<script>window.onload=function(){setTimeout(function(){window.print();},250);};<' + "/script>"
    : "";

  return `<!doctype html><html><head><meta charset="utf-8">
  <title>Challan — ${esc(data.challanNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body { margin:0; background:#e9e9ec; font-family: Arial, Helvetica, sans-serif; color:#000; font-size:9pt; }

    /* A real A4 sheet on screen as well as on paper — the preview is the page. */
    .sheet {
      width:210mm; min-height:297mm; padding:14mm 12mm;
      margin:8mm auto; background:#fff; box-shadow:0 1px 6px rgba(0,0,0,.28);
      display:flex; flex-direction:column;
    }

    .letterhead { text-align:center; }
    .co { font-size:17pt; font-weight:700; letter-spacing:.5px; }
    .addr { font-size:8pt; margin-top:1.5mm; }
    .rule { border-bottom:2px solid #000; margin:3mm 0 0; }

    .title { text-align:center; margin:5mm 0 4mm; }
    .title span { display:inline-block; border:1px solid #000; padding:1.5mm 7mm; font-size:10pt; }

    /* Challan To | Challan Details */
    .parties { display:flex; gap:10mm; }
    .party { flex:1; }
    .party h4 { margin:0 0 1mm; font-size:9pt; font-weight:400; }
    .party h4 b { font-weight:700; }
    .party .hr { border-bottom:1px solid #9ab89a; margin-bottom:1.5mm; }
    .party .row { line-height:1.65; }
    .party .lbl { color:#333; }
    .party .val { font-weight:700; }
    /* The right-hand block aligns its values to the sheet edge, as the pad does. */
    .details .row { display:flex; justify-content:space-between; gap:4mm; }

    table { width:100%; border-collapse:collapse; margin-top:5mm; font-size:8.5pt; }
    th, td { border:1px solid #000; padding:1mm 2mm; }
    th { text-align:center; font-weight:700; }
    td.c { text-align:center; }
    .w-sl { width:10mm; } .w-uom { width:20mm; } .w-qty { width:24mm; } .w-rem { width:46mm; }
    tfoot td { font-weight:700; text-align:center; }

    .fill { flex:1; }

    /* Signed for by the receiving party — the block they complete by hand. */
    .sign { font-size:9pt; }
    .sign .line { margin-bottom:6mm; }
    .sign .who { display:flex; justify-content:space-between; margin-top:8mm; }
    .sign .who div { width:70mm; border-top:1px solid #000; padding-top:1.5mm; text-align:center; font-size:8pt; }
    .sign .who div.right { text-align:center; }

    @media print {
      body { background:#fff; }
      /* A hair under 297mm: at exactly the page height Chrome's rounding tips
         the sheet over the page box and emits a blank page after it. */
      .sheet { min-height:296mm; margin:0; box-shadow:none; }
    }
  </style></head><body>
    <div class="sheet">
      <div class="letterhead">
        <div class="co">${esc(data.companyName)}</div>
        ${data.companyAddress ? `<div class="addr">${esc(data.companyAddress)}</div>` : ""}
        <div class="addr">VAT Reg No: ${esc(data.vatNo ?? "—")}${data.mobileNo ? ` · Tel: ${esc(data.mobileNo)}` : ""}</div>
        <div class="rule"></div>
      </div>

      <div class="title"><span>Challan</span></div>

      <div class="parties">
        <div class="party">
          <h4>Challan <b>To</b></h4>
          <div class="hr"></div>
          <div class="row"><span class="lbl">Customer Name: </span><span class="val">${esc(data.customerName ?? "")}</span></div>
          <div class="row"><span class="lbl">Address : ${esc(data.customerAddress ?? "")}</span></div>
          <div class="row"><span class="lbl">Contact Person: ${esc(data.contactPerson ?? "")}</span></div>
          <div class="row"><span class="lbl">Contact No: ${esc(data.contactNo ?? "")}</span></div>
        </div>
        <div class="party details">
          <h4>Challan <b>Details</b></h4>
          <div class="hr"></div>
          <div class="row"><span class="lbl">Challan No:</span><span class="val">${esc(data.challanNo)}</span></div>
          <div class="row"><span class="lbl">Challan Date:</span><span>${esc(formatChallanDate(data.challanDate))}</span></div>
          <div class="row"><span class="lbl">PO No:</span><span>${esc(data.poNo ?? "")}</span></div>
          <div class="row"><span class="lbl">PO Date:</span><span>${esc(formatChallanDate(data.poDate))}</span></div>
          <div class="row"><span class="lbl">Delivery Address: ${esc(data.deliveryAddress ?? "")}</span></div>
        </div>
      </div>

      <div class="fill">
        <table>
          <thead>
            <tr>
              <th class="w-sl">Sl</th>
              <th>Description</th>
              <th class="w-uom">UOM</th>
              <th class="w-qty">Qty</th>
              <th class="w-rem">Remarks</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td class="c" colspan="5">No items on this challan.</td></tr>`}</tbody>
          <tfoot>
            <tr>
              <td colspan="3">Total</td>
              <td class="c">${esc(qtyText(total))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="sign">
        <div class="line">Name:</div>
        <div class="line">Contact Number:</div>
        <div class="line">Signature with Seal:</div>
        <div class="who">
          <div>Received By</div>
          <div class="right">For ${esc(data.companyName)}</div>
        </div>
      </div>
    </div>
    ${autoPrintScript}
  </body></html>`;
}

/** Opens the challan in a new tab. Returns false when the popup was blocked, so
 *  the caller can surface a toast. */
function open(data: CustomerChallanData, autoPrint: boolean): boolean {
  if (typeof window === "undefined") return false;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(buildDocument(data, autoPrint));
  w.document.close();
  return true;
}

export const previewCustomerChallan = (data: CustomerChallanData) => open(data, false);
export const printCustomerChallan = (data: CustomerChallanData) => open(data, true);
