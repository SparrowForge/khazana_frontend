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

export interface AssortmentPayload {
  code?: string;
  date: string;
  type: string;
  items: SaleItem[];
  totalAmt: number;
  discAmt: number;
  netAmt: number;
  customerpay: number;
  change: number;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const createAssortment = (data: AssortmentPayload) =>
  api
    .post("/assortment", {
      code: data.code || undefined, // blank → backend can auto-generate
      date: data.date,
      type: data.type,
      totalAmt: data.totalAmt,
      discAmt: data.discAmt,
      netAmt: data.netAmt,
      customerpay: data.customerpay,
      change: data.change,
      items: data.items.map((it) => ({
        itemOID: it.itemId,
        qty: it.quantity,
        price: it.rate,
        amount: it.rate * it.quantity,
        discount: it.discount,
        vatAmount: it.vat,
        netAmount: it.total,
      })),
    })
    .then((r) => { emitStockChanged("assortment:create"); return r.data; });
