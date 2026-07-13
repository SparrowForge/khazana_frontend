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
  totalDiscount: number;
  totalVat: number;
  netAmount: number;
  payableAmount: number;
}

export const fetchCreditInvoice = (id: string) =>
  api.get<CreditInvoice>(`/sales/credit/${id}/invoice`).then((r) => r.data);
