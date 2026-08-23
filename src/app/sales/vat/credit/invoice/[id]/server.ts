import api from "@/lib/api";

/** Shape returned by GET /sales/vat/credit/:id/invoice — everything needed to
 *  print, in either the thermal (POS-style) or the corporate A4 format. */
export interface VatCreditInvoiceItem {
  itemCode: string;
  itemName: string;
  uom: string;
  quantity: number;
  rate: number;
  discount: number;
  vat: number;
  total: number;
}

export interface VatCreditInvoice {
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
    /** Branch code — drives the default print format (factory = A4). */
    code?: string | null;
    name?: string | null;
    address?: string | null;
    vatNo?: string | null;
    mobileNo?: string | null;
  } | null;
  items: VatCreditInvoiceItem[];
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  netAmount: number;
  payableAmount: number;
}

export const fetchVatCreditInvoice = (id: string) =>
  api.get<VatCreditInvoice>(`/sales/vat/credit/${id}/invoice`).then((r) => r.data);
