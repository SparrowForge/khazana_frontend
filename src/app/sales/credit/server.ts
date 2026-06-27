import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface CreditSalePayload {
  invoiceNo?: string;
  invoiceDate: string;
  clientCode: string;
  poNo?: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  netAmount: number;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchCustomers = () =>
  api.get<{ data: { id: number; code: string; name: string }[] } | { id: number; code: string; name: string }[]>("/customers?limit=100")
    .then(unwrapList<{ id: number; code: string; name: string }>);

export const createCreditSale = (data: CreditSalePayload) => {
  // Map the UI's SaleItem/payload shape onto CreateCreditSaleDto and drop
  // display-only / unsupported fields so the strict ValidationPipe doesn't 400.
  // Credit items are keyed by itemCode (not itemId) and use qty/disc.
  const payload = {
    invNo: data.invoiceNo || undefined, // blank → backend auto-generates
    invDate: data.invoiceDate,
    clientCode: data.clientCode,
    poNo: data.poNo || undefined,
    totalAmount: data.totalAmount,
    totalDiscount: data.totalDiscount,
    items: data.items.map((it) => ({
      itemCode: it.itemCode,
      qty: it.quantity,
      rate: it.rate,
      disc: it.discount,
      vat: it.vat,
      total: it.total,
    })),
  };
  return api.post("/sales/credit", payload).then((r) => r.data);
};
