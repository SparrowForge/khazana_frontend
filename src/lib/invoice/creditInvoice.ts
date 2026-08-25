import api from "@/lib/api";

/** Shape returned by the credit-sale invoice endpoints — everything needed to
 *  print, in either the thermal (POS-style) or the corporate A4 format. */
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
  /** Absent on the public payload — the customer's copy carries no internal id. */
  id?: string;
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
    /** Branch code — drives the default print format (factory = A4). */
    code?: string | null;
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

/** Staff copy — behind login. */
export const fetchCreditInvoice = (id: string) =>
  api.get<CreditInvoice>(`/sales/credit/${id}/invoice`).then((r) => r.data);

/** Customer copy — no login required. See `publicInvoiceUrl` for the caveat on
 *  what that means. */
export const fetchPublicCreditInvoice = (id: string) =>
  api.get<CreditInvoice>(`/sales/public/credit/${id}/invoice`).then((r) => r.data);

/**
 * The link to hand a customer.
 *
 * Anyone holding it can read the invoice — there is no login, no expiry and no
 * revocation. The sale's UUID is the only thing protecting it: 122 bits of
 * entropy, so it cannot be guessed or enumerated, but it also cannot be taken
 * back once sent. Treat the URL itself as the secret.
 */
export const publicInvoiceUrl = (id: string) =>
  typeof window === "undefined" ? "" : `${window.location.origin}/invoice/credit/${id}`;
