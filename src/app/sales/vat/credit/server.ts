import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

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

export const fetchCustomers = () =>
  api.get<{ data: { id: number; code: string; name: string }[] } | { id: number; code: string; name: string }[]>("/customers?limit=100")
    .then(unwrapList<{ id: number; code: string; name: string }>);

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
  return api.post<CreatedVatCreditSale>("/sales/vat/credit", payload).then((r) => r.data);
};
