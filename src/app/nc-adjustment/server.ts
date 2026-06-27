import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface NcPayload {
  code?: string;
  date: string;
  name?: string;
  contactNo?: string;
  reference?: string;
  items: SaleItem[];
  netAmount: number;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const createNcAdjustment = (data: NcPayload) => {
  // Map the UI's SaleItem shape onto the backend CreateNcAdjustmentDto and drop
  // display-only / unsupported fields (itemCode, itemName, root netAmount) so the
  // strict whitelist + forbidNonWhitelisted ValidationPipe doesn't 400.
  const payload = {
    code: data.code || undefined,
    date: data.date,
    name: data.name || undefined,
    contactNo: data.contactNo || undefined,
    reference: data.reference || undefined,
    items: data.items.map((it) => ({
      itemId: it.itemId,
      qty: it.quantity,
      price: it.rate,
      discount: it.discount,
      vatAmount: it.vat,
      netAmount: it.total,
    })),
  };
  return api.post("/nc-adjustment", payload).then((r) => r.data);
};
