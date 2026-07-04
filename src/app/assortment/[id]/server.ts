import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
}

/** Shape returned by GET /assortment/:id, mapped to the UI's SaleItem shape. */
export interface AssortmentRecord {
  id: string;
  code: string;
  date: string | null;
  type: string;
  paidAmount: number;
  items: SaleItem[];
}

export interface UpdateAssortmentPayload {
  date: string;
  type: string;
  items: SaleItem[];
  totalAmt: number;
  discAmt: number;
  netAmt: number;
  customerpay: number;
  change: number;
}

// Raw detail line as returned by the API (AsstDet + joined item).
interface RawDetail {
  itemOID: string;
  qty?: number | string | null;
  price?: number | string | null;
  discount?: number | string | null;
  vatAmount?: number | string | null;
  netAmount?: number | string | null;
  item?: { itmCode?: string; itmName?: string } | null;
}

interface RawAssortment {
  id: string;
  code?: string | null;
  date?: string | null;
  type?: string | null;
  customerpay?: number | string | null;
  details?: RawDetail[];
}

const num = (v: unknown): number => (v == null ? 0 : Number(v)) || 0;

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchAssortment = (id: string) =>
  api.get<RawAssortment>(`/assortment/${id}`).then((r): AssortmentRecord => {
    const a = r.data;
    return {
      id: a.id,
      code: a.code ?? "",
      date: a.date ?? null,
      type: a.type ?? "Regular",
      paidAmount: num(a.customerpay),
      items: (a.details ?? []).map((d) => {
        const rate = num(d.price);
        const quantity = num(d.qty);
        const discount = num(d.discount);
        return {
          itemId: d.itemOID,
          itemCode: d.item?.itmCode ?? "",
          itemName: d.item?.itmName,
          quantity,
          rate,
          discount,
          vat: num(d.vatAmount),
          total: num(d.netAmount) || rate * quantity - discount,
        };
      }),
    };
  });

export const updateAssortment = (id: string, data: UpdateAssortmentPayload) =>
  api
    .patch(`/assortment/${id}`, {
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
    .then((r) => r.data);
