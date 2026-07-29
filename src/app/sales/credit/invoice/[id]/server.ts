import api from "@/lib/api";

/** Shape returned by GET /sales/credit/:id/invoice — everything needed to print,
 *  in either the thermal (POS-style) or the corporate A4 format. */
export interface CreditInvoiceItem {
  itemCode: string;
  itemName: string;
  uom: string;
  quantity: number;
  rate: number;
  discount: number;
  vat: number;
  total: number;
}

export interface CreditInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string | null;
  poNo: string | null;
  invoiceBy: string | null;
  customer: {
    code: string;
    name: string;
    mobile?: string | null;
    address?: string | null;
  } | null;
  branch: {
    name?: string | null;
    address?: string | null;
    vatNo?: string | null;
    mobileNo?: string | null;
  } | null;
  items: CreditInvoiceItem[];
  totalAmount: number;
  /** Line discounts + the invoice-level discount, as money. */
  totalDiscount: number;
  /** The per-line discounts alone, already netted off each line's total. */
  lineDiscount: number;
  /** Invoice-level discount rate, charged on the VAT-inclusive gross. */
  discountPercent: number;
  /** What that rate comes to in money. */
  invoiceDiscount: number;
  totalVat: number;
  netAmount: number;
  /** Net + VAT, i.e. what the invoice-level discount is charged on. */
  grossAmount: number;
  payableAmount: number;
  /** Money already collected — the advance on the order this invoice was raised
   *  against (matched via PO No), otherwise 0. */
  paidAmount: number;
  dueAmount: number;
}

export const fetchCreditInvoice = (id: string) =>
  api.get<CreditInvoice>(`/sales/credit/${id}/invoice`).then((r) => r.data);
