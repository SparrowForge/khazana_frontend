import api from "@/lib/api";

/** Shape returned by GET /nc-adjustment/:id/invoice — everything needed to print,
 *  in either the thermal (POS-style) or the corporate A4 format. Mirrors the
 *  credit-sale invoice payload so both documents lay out the same way. */
export interface NcInvoiceItem {
  itemCode: string;
  itemName: string;
  uom: string;
  quantity: number;
  rate: number;
  discount: number;
  vat: number;
  total: number;
}

export interface NcInvoice {
  id: string;
  ncCode: string | null;
  ncDate: string | null;
  /** Who the non-charge goods went to, and why. Name and contact no come off
   *  the linked customer (older NCs fall back to the free text they were typed
   *  with); `customerCode` is null on those legacy rows. */
  name: string | null;
  contactNo: string | null;
  customerCode: string | null;
  reference: string | null;
  issuedBy: string | null;
  branch: {
    name?: string | null;
    address?: string | null;
    vatNo?: string | null;
    mobileNo?: string | null;
  } | null;
  items: NcInvoiceItem[];
  /** Gross of line discounts (rate × qty). */
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  /** Line totals, discounts already netted off. */
  netAmount: number;
  /** Net + VAT — the value of the goods issued. Nothing is collected on an NC. */
  grossAmount: number;
}

export const fetchNcInvoice = (id: string) =>
  api.get<NcInvoice>(`/nc-adjustment/${id}/invoice`).then((r) => r.data);
