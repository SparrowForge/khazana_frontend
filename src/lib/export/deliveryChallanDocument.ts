// The pre-printed stock-movement pads, reproduced as real A4 portrait sheets:
// letterhead, From/To branches, then SL / Item Of Name / qty with the remaining
// columns left blank for the receiving shop to fill in by hand.
//
// Three documents share this one engine. The first two are the same piece of
// paper read from either end, and any drift between them would break the check
// the outlet performs on arrival:
//
//   Delivery Challan    — travels WITH a Stock Issue (the sending branch's copy)
//   Goods Received Note — the Stock Receive pad (the receiving branch's copy)
//   Vehicle Challan     — the gate pass for a loaded van touring the outlets.
//                         Same sheet, but no destination branch: the route
//                         heads the pad and a vehicle/driver line sits under it.
//
// Laid out as sheets rather than one full-width flow, so the on-screen preview
// is the same page the printer produces. A long document is split across
// numbered sheets; the total and the signature block belong to the last one only,
// where they sit directly under the final row rather than at the foot of the sheet.

export interface DeliveryChallanLine {
  itemName: string;
  /** Printed in brackets after the name — "Chanar Laddu (KG)". */
  uom?: string;
  qty: number;
}

export interface DeliveryChallanData {
  companyName: string;
  /** Fallback letterhead address, used only when the owning branch has none of
   *  its own. */
  companyAddress?: string;
  /** Address of the branch this document BELONGS to — the issuing branch on a
   *  Delivery Challan, the receiving branch on a Goods Received Note. It is the
   *  branch address, not the company's, that heads the pad. */
  letterheadAddress?: string;
  /** The issuing branch (factory/warehouse) — shown as "From:" */
  fromBranchName?: string;
  /** The receiving outlet — the underlined heading under the letterhead. On a
   *  Vehicle Challan there is no receiving outlet, so the route goes here. */
  toBranchName: string;
  /** Vehicle Challan only: printed as a line under the From/To block. The
   *  branch-to-branch pads leave these undefined and the line is omitted. */
  vehicleNo?: string;
  driverName?: string;
  driverMobile?: string;
  /** Printed after the document-number label; the voucher number, falling back
   *  to the serial. */
  challanNo: string;
  issueDate: string | Date;
  /** Stamped as "Time -"; defaults to when the document is built. */
  printedAt?: Date;
  preparedBy?: string;
  /** Form revision marker in the bottom-left corner of the pre-printed pad. */
  revision?: string;
  items: DeliveryChallanLine[];
}

/** What distinguishes one pad from the other. Everything else — the sheet, the
 *  letterhead, the pagination, the CSS — is shared. */
interface PadSpec {
  /** Centre heading, and the browser tab title. */
  title: string;
  /** Label before the document number, e.g. "Challan No-". */
  docNoLabel: string;
  /** Header over the quantity column. */
  qtyHeader: string;
  /** Trailing columns printed empty for hand-filling on arrival. */
  blankHeaders: string[];
  signRoles: string[];
}

const CHALLAN_SPEC: PadSpec = {
  title: "Delivery Challan",
  docNoLabel: "Challan No-",
  qtyHeader: "Delivery",
  blankHeaders: ["Received Qty", "Remarks"],
  signRoles: ["Checked By Security", "Delivery Man", "Received By (Sales Man)", "Manager"],
};

const GRN_SPEC: PadSpec = {
  // The receiving end of the same movement: the quantity is what actually
  // arrived, so only Remarks is left open.
  title: "Goods Received Note",
  docNoLabel: "GRN No-",
  qtyHeader: "Received Qty",
  blankHeaders: ["Remarks"],
  signRoles: ["Received By", "Checked By", "Store Keeper", "Manager"],
};

const VEHICLE_SPEC: PadSpec = {
  // Same sheet as the Delivery Challan, by request — an outlet taking goods off
  // the van fills in the same two hand-written columns it would on a delivery,
  // and the same four people sign for it.
  title: "Challan",
  docNoLabel: "Challan No-",
  qtyHeader: "Delivery",
  blankHeaders: ["Received Qty", "Remarks"],
  signRoles: ["Checked By Security", "Delivery Man", "Received By (Sales Man)", "Manager"],
};

/** Rows per sheet. Deliberately short of what the page could hold — the last
 *  sheet also carries the total and the four signature lines under their 2in of
 *  signing space, and a sheet that overflowed its 297mm would print a near-blank
 *  extra page after it. At 28 rows the full stack — header, table, signatures
 *  and foot — comes to roughly 281mm of the 296mm available. */
const ROWS_PER_PAGE = 28;

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const qty = (n: number) => Number(n || 0).toFixed(2);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "25-Aug-2026". A bare "YYYY-MM-DD" (what the entry form holds) is read as a
 *  plain calendar date — going through the local timezone would shift it a day
 *  either side of midnight. */
export function formatChallanDate(value: string | Date): string {
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** "11:09 am" — lowercase meridiem, as the original form prints it. */
function formatChallanTime(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min} ${d.getHours() >= 12 ? "pm" : "am"}`;
}

/** Name as it prints in the Item Of Name column, unit of measure included. */
export const challanItemName = (line: { itemName: string; uom?: string }) =>
  line.uom ? `${line.itemName} (${line.uom})` : line.itemName;

/** Alphabetical by printed name, as on the original pad — the outlet ticks the
 *  delivery off against it by eye, so the order has to be predictable. */
export const sortChallanLines = <T extends { itemName: string; uom?: string }>(lines: T[]): T[] =>
  [...lines].sort((a, b) => challanItemName(a).localeCompare(challanItemName(b)));

const chunk = <T,>(rows: T[], size: number): T[][] => {
  if (rows.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

function sheetHtml(
  data: DeliveryChallanData,
  spec: PadSpec,
  rows: DeliveryChallanLine[],
  startSl: number,
  page: number,
  pages: number,
  total: number,
  printedAt: Date,
): string {
  const isLast = page === pages;
  // SL + name + qty, then however many hand-fill columns this pad has.
  const cols = 3 + spec.blankHeaders.length;
  const blankCells = spec.blankHeaders.map(() => "<td></td>").join("");

  const body = rows
    .map(
      (r, i) => `<tr>
        <td class="sl">${startSl + i}</td>
        <td>${esc(challanItemName(r))}</td>
        <td class="num">${esc(qty(r.qty))}</td>
        ${blankCells}
      </tr>`,
    )
    .join("");

  // The pad belongs to one branch, so the letterhead carries that branch's own
  // address. The company address is only a fallback for a branch whose address
  // has not been filled in.
  const letterheadAddress = data.letterheadAddress || data.companyAddress;

  return `<div class="sheet">
    <div class="letterhead">
      <div class="co">${esc(data.companyName)}</div>
      ${letterheadAddress ? `<div class="addr">${esc(letterheadAddress)}</div>` : ""}
    </div>
    ${data.fromBranchName ? `<div class="from-branch">From: <span>${esc(data.fromBranchName)}</span></div>` : ""}
    <div class="branch">To: <span class="${data.toBranchName ? "" : "blank"}">${esc(data.toBranchName)}</span></div>
    ${
      data.vehicleNo || data.driverName
        ? `<div class="vehicle">${[
            data.vehicleNo ? `Vehicle No: <b>${esc(data.vehicleNo)}</b>` : "",
            data.driverName ? `Driver: <b>${esc(data.driverName)}</b>` : "",
            data.driverMobile ? `Mobile: <b>${esc(data.driverMobile)}</b>` : "",
          ]
            .filter(Boolean)
            .join(" &nbsp;&nbsp;|&nbsp;&nbsp; ")}</div>`
        : ""
    }
    <div class="meta">
      <span class="l">Date- ${esc(formatChallanDate(data.issueDate))}</span>
      <span class="c"></span>
      <span class="r">Time - ${esc(formatChallanTime(printedAt))}</span>
    </div>
    <div class="meta">
      <span class="l">${esc(spec.docNoLabel)} ${esc(data.challanNo)}</span>
      <span class="c title">${esc(spec.title)}</span>
      <span class="r"></span>
    </div>
    <div class="fill">
      <table>
        <thead>
          <tr>
            <th class="w-sl">SL No</th>
            <th class="w-name">Item Of Name</th>
            <th class="w-qty">${esc(spec.qtyHeader)}</th>
            ${spec.blankHeaders.map((h) => `<th class="w-blank">${esc(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${body || `<tr><td class="empty" colspan="${cols}">No items on this document.</td></tr>`}</tbody>
        ${
          isLast
            ? `<tfoot><tr>
                 <td class="bare"></td>
                 <td class="bare"></td>
                 <td class="bare num total">${esc(qty(total))}</td>
                 ${spec.blankHeaders.map(() => `<td class="bare"></td>`).join("")}
               </tr></tfoot>`
            : ""
        }
      </table>
      ${
        // Inside .fill, directly under the last line of the document: the roles
        // sign against the goods they can see, not at the foot of a sheet that
        // may be mostly empty. The clear space above the rules is the room they
        // sign in — see .signs.
        isLast
          ? `<div class="signs">${spec.signRoles
              .map((role) => `<div class="sign"><div class="rule"></div><div class="role">${esc(role)}</div></div>`)
              .join("")}</div>`
          : ""
      }
    </div>
    <div class="foot">
      <span class="rev">${esc(data.revision ?? "REV#0")}</span>
      <span class="by">${data.preparedBy ? `Prepared By ${esc(data.preparedBy)}` : ""}</span>
      <span class="pg">Page ${page} of ${pages}</span>
    </div>
  </div>`;
}

function buildPadDocument(data: DeliveryChallanData, spec: PadSpec, autoPrint: boolean): string {
  const printedAt = data.printedAt ?? new Date();
  const lines = sortChallanLines(data.items);
  const total = lines.reduce((sum, r) => sum + Number(r.qty || 0), 0);
  const pages = chunk(lines, ROWS_PER_PAGE);

  const sheets = pages
    .map((rows, i) =>
      sheetHtml(data, spec, rows, i * ROWS_PER_PAGE + 1, i + 1, pages.length, total, printedAt),
    )
    .join("");

  const autoPrintScript = autoPrint
    ? '<script>window.onload=function(){setTimeout(function(){window.print();},250);};<' + '/script>'
    : "";

  return `<!doctype html><html><head><meta charset="utf-8">
  <title>${esc(spec.title)} — ${esc(data.challanNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body { margin:0; background:#e9e9ec; font-family: "Times New Roman", Times, serif; color:#000; }

    /* A real A4 sheet, on screen as well as on paper — the preview is the page. */
    .sheet {
      width: 210mm; min-height: 297mm; padding: 12mm 10mm;
      margin: 8mm auto; background:#fff; box-shadow: 0 1px 6px rgba(0,0,0,.28);
      display:flex; flex-direction:column;
    }
    .fill { flex:1; }

    .letterhead { text-align:center; }
    .co { font-size:15pt; font-weight:700; font-style:italic; }
    .addr { font-size:9pt; font-style:italic; }
    .from-branch { text-align:left; font-size:10pt; margin:4mm 0 2mm; }
    .from-branch span { font-weight:600; }
    .branch { text-align:center; margin:2mm 0 2mm; font-size:11pt; font-weight:700; }
    .branch span { border-bottom:1px solid #000; padding:0 2mm 1px; }
    /* A Vehicle Challan can be raised before the route or van is decided. With
       nothing to print, the underline would collapse to a 4mm stub; widen it
       into a rule long enough to write the destination on by hand. */
    .branch span.blank { display:inline-block; min-width:70mm; }
    /* Vehicle Challan only — the van and who is driving it, since there is no
       receiving branch to identify the delivery by. */
    .vehicle { text-align:center; font-size:10pt; margin-bottom:2mm; }

    .meta { display:flex; align-items:flex-end; font-size:10pt; margin-bottom:1.5mm; }
    .meta .l, .meta .r { flex:1; }
    .meta .r { text-align:right; }
    .meta .c { flex:1.4; text-align:center; }
    .meta .title { font-size:13pt; font-weight:700; }

    table { width:100%; border-collapse:collapse; font-size:10pt; margin-top:1mm; }
    th, td { border:1px solid #000; padding:1px 2mm; height:5.2mm; }
    th { font-weight:700; text-align:center; }
    tbody td { border-top:1px dotted #9a9a9a; border-bottom:1px dotted #9a9a9a; }
    /* The grid closes on a solid rule: the dotted lines separate one written
       line from the next, but the bottom of the last row is the edge of the
       box, not another divider. */
    tbody tr:last-child td { border-bottom:1px solid #000; }
    td.sl { text-align:center; }
    td.num, th.num { text-align:right; padding-right:6mm; }
    td.empty { text-align:center; color:#666; height:12mm; }
    .w-sl { width:12mm; } .w-qty { width:26mm; } .w-blank { width:38mm; }
    /* The total hangs under the Delivery column, outside the ruled grid. */
    tfoot td.bare { border:none; }
    tfoot td.total { font-weight:700; }

    /* Follows the last row of the table. The 2in gap above the rules is the
       signing space itself — deliberately generous, so a name, a seal and a
       date all fit between the goods and the line. Kept whole: a signature
       block split across two sheets is not a signature block. */
    .signs { display:flex; gap:8mm; margin-top:2in; text-align:center; break-inside:avoid; }
    .sign { flex:1; }
    .rule { border-top:1px dotted #000; }
    .role { font-size:9pt; margin-top:1mm; }

    .foot { display:flex; gap:6mm; font-size:8pt; padding-top:4mm; }
    .foot .rev { flex:0 0 auto; }
    .foot .by { flex:1; }
    .foot .pg { flex:0 0 auto; text-align:right; }

    @media print {
      body { background:#fff; }
      /* A hair under 297mm: at exactly the page height Chrome's rounding tips
         the sheet over the page box and emits a blank page after every one. */
      .sheet { min-height:296mm; margin:0; box-shadow:none; break-after:page; }
      .sheet:last-child { break-after:auto; }
    }
  </style></head><body>
    ${sheets}
    ${autoPrintScript}
  </body></html>`;
}

/** Opens a pad in a new tab, printing it once it paints if asked. Returns false
 *  when the popup was blocked, so the caller can surface a toast. */
function openPad(data: DeliveryChallanData, spec: PadSpec, autoPrint: boolean): boolean {
  if (typeof window === "undefined") return false;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(buildPadDocument(data, spec, autoPrint));
  w.document.close();
  return true;
}

/** Opens the Delivery Challan without triggering the print dialog. */
export const previewDeliveryChallan = (data: DeliveryChallanData) => openPad(data, CHALLAN_SPEC, false);

/** Opens the Delivery Challan and prints it once it paints. */
export const printDeliveryChallan = (data: DeliveryChallanData) => openPad(data, CHALLAN_SPEC, true);

/** Opens the Goods Received Note — the Stock Receive side of the same pad. */
export const previewGoodsReceivedNote = (data: DeliveryChallanData) => openPad(data, GRN_SPEC, false);

/** Opens the Goods Received Note and prints it once it paints. */
export const printGoodsReceivedNote = (data: DeliveryChallanData) => openPad(data, GRN_SPEC, true);

/** Opens the Vehicle Challan — the gate pass for a loaded van. Same sheet as
 *  the Delivery Challan; it records what left the factory, not a stock move. */
export const previewVehicleChallan = (data: DeliveryChallanData) => openPad(data, VEHICLE_SPEC, false);

/** Opens the Vehicle Challan and prints it once it paints. */
export const printVehicleChallan = (data: DeliveryChallanData) => openPad(data, VEHICLE_SPEC, true);
