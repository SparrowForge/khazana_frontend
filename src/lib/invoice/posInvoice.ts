import type { CreditInvoice } from "@/lib/invoice/creditInvoice";
import type { PosSale } from "@/lib/services/pos.service";

/**
 * A POS sale, in the shape the A4 documents read.
 *
 * The corporate invoice and the delivery challan are written against
 * `CreditInvoice`. Rather than fork either of them for the terminal — two more
 * copies of a page that has to agree with the credit-sale one figure for figure
 * — a POS sale is adapted into that shape here, and the same two components
 * print it. Everything specific to a running sale is resolved in this one
 * function.
 */
export function posSaleToInvoice(sale: PosSale): CreditInvoice {
  const totalAmount = Number(sale.totalAmount) || 0;
  const totalVat = Number(sale.vatAmount) || 0;
  const invoiceDiscount = Number(sale.discountAmount) || 0;
  const payableAmount = Number(sale.payableAmount) || 0;
  // Sub-total and VAT are un-netted: the POS folds its document discount into
  // the line discount columns but leaves SODet_Amount gross, so the discount is
  // shown once at the foot of the totals block, the way the terminal shows it.
  const grossAmount = totalAmount + totalVat;
  // Only ever stored as money; the invoice prints it as a rate, so derive one.
  const discountPercent = grossAmount > 0 ? (invoiceDiscount / grossAmount) * 100 : 0;

  return {
    id: sale.id,
    invoiceNo: sale.invoiceNo,
    invoiceDate: sale.dateTime,
    // A walk-in has no purchase order.
    poNo: null,
    invoiceBy: sale.servedBy || null,
    // The terminal's pay mode, so a cash sale does not print "Credit". Card
    // sales name the bank, which is the only place the A4 sheet records it.
    saleType: sale.bankName ? `${sale.salesType} — ${sale.bankName}` : sale.salesType,
    customer: {
      // A counter sale names its customer now, so the document can print their
      // code and phone number the way a credit invoice does. A walk-in has no
      // Customer row and leaves all three blank.
      code: sale.customerCode ?? "",
      // Failing a picked customer: the discount authoriser, which is the only
      // name a sale rung up before the picker existed can have. Same order the
      // Sales History Summary resolves it in. Failing both, the document says
      // what the sale was rather than leaving the line blank.
      name:
        (sale.customerName ?? "").trim() ||
        (sale.discountRemarks ?? "").trim() ||
        "Walk-in Customer",
      mobile: sale.customerMobile ?? null,
      address: null,
    },
    branch: sale.branch
      ? {
          name: sale.branch.name,
          address: sale.branch.address,
          vatNo: sale.branch.vatNo,
          mobileNo: sale.branch.mobileNo,
        }
      : null,
    items: sale.items.map((item) => ({
      itemCode: item.itemCode ?? "",
      itemName: item.productName,
      uom: item.uom ?? "",
      quantity: Number(item.qty) || 0,
      rate: Number(item.rate) || 0,
      // Per-line discounts are not shown: the terminal applies one discount to
      // the whole sale, and it is reported as such below. Splitting it back
      // across the lines here would double-count it against `total`, which the
      // API returns un-netted.
      discount: 0,
      vat: Number(item.vat) || 0,
      total: Number(item.total) || 0,
    })),
    totalAmount,
    totalDiscount: invoiceDiscount,
    lineDiscount: 0,
    discountPercent,
    invoiceDiscount,
    totalVat,
    netAmount: totalAmount,
    grossAmount,
    payableAmount,
    // A counter sale is settled in full before the customer leaves, so the
    // invoice is paid and nothing is due. What was tendered and what came back
    // as change belong on the receipt, not on a document that states what this
    // sale was worth.
    paidAmount: payableAmount,
    dueAmount: 0,
  };
}
