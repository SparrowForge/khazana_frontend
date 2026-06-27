import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface VatCashSalePayload {
  invoiceNo?: string;
  invoiceDate: string;
  vatClnNo?: string;
  paymentMethod: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  netAmount: number;
  paidAmount: number;
  changeAmount: number;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

const VAT_RATE = 0.15; // flat rate the VAT pages apply

const round2 = (n: number) => Math.round(n * 100) / 100;

export const createVatCashSale = (data: VatCashSalePayload) => {
  // Map the UI's SaleItem shape onto CreateVatCashSaleDto. The UI tracks VAT only
  // at the summary level (flat 15%), so derive per-line vatValue/vatAmount here.
  const payload = {
    invoiceNo: data.invoiceNo || undefined, // blank → backend auto-generates
    invoiceDate: data.invoiceDate,
    vatClnNo: data.vatClnNo || undefined,
    paymentMethod: data.paymentMethod,
    totalAmount: data.totalAmount,
    totalDiscount: data.totalDiscount,
    totalVat: data.totalVat,
    netAmount: data.netAmount,
    paidAmount: data.paidAmount,
    changeAmount: data.changeAmount,
    items: data.items.map((it) => {
      const taxable = it.rate * it.quantity - it.discount;
      const vatAmount = round2(taxable * VAT_RATE);
      return {
        itemId: it.itemId,
        quantity: it.quantity,
        rate: it.rate,
        discount: it.discount,
        vatValue: VAT_RATE * 100,
        vatAmount,
        netAmount: round2(taxable + vatAmount),
      };
    }),
  };
  return api.post("/sales/vat/cash", payload).then((r) => r.data);
};
