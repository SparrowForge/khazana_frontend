import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";
import { emitStockChanged } from "@/lib/stockEvents";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface VatCreditSalePayload {
  invoiceNo?: string;
  invoiceDate: string;
  clientCode: string;
  vatClnNo?: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  netAmount: number;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

/** Customer options for the VAT credit invoice header. Keyed by code, which is
 *  what CSVMaster stores (the uuid migration is still pending). */
export interface VatCreditCustomer {
  id: number;
  code: string;
  name: string;
  /** Contact no — searchable in the picker, and shown on the row there. */
  mobile?: string;
  address?: string;
}

/** Customers for the picker: /customers/options is flat and un-capped, unlike
 *  the paginated /customers, which stops at 100 rows — a customer past the
 *  hundredth by name could not be billed at all. Carries the contact no, which
 *  the picker searches alongside the code and the name. */
export const fetchCustomers = () =>
  api.get<{ data: VatCreditCustomer[] } | VatCreditCustomer[]>("/customers/options")
    .then(unwrapList<VatCreditCustomer>);

const VAT_RATE = 0.15; // flat rate the VAT pages apply

const round2 = (n: number) => Math.round(n * 100) / 100;

/** POST /sales/vat/credit responds with the created row — we only need the
 *  id, to jump straight to its invoice. */
interface CreatedVatCreditSale {
  id?: string;
}

export const createVatCreditSale = (data: VatCreditSalePayload) => {
  // Map the UI's SaleItem shape onto CreateVatCreditSaleDto (items keyed by
  // itemId/qty/disc). Derive per-line vatValue/vatAmount from the flat 15%.
  const payload = {
    invNo: data.invoiceNo || undefined, // blank → backend auto-generates
    invDate: data.invoiceDate,
    clientCode: data.clientCode,
    totalAmount: data.totalAmount,
    totalDiscount: data.totalDiscount,
    totalVat: data.totalVat,
    items: data.items.map((it) => {
      const taxable = it.rate * it.quantity - it.discount;
      const vatAmount = round2(taxable * VAT_RATE);
      return {
        itemId: it.itemId,
        qty: it.quantity,
        rate: it.rate,
        disc: it.discount,
        vatValue: VAT_RATE * 100,
        vatAmount,
        total: round2(taxable + vatAmount),
      };
    }),
  };
  return api.post<CreatedVatCreditSale>("/sales/vat/credit", payload)
    .then((r) => { emitStockChanged("vat-credit-sale:create"); return r.data; });
};
