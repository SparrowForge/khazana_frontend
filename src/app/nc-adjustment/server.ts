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

/** Backend t_NCMstr + details (item joined) returned by GET /nc-adjustment/:id. */
export interface NcDetail {
  ncdetItemOID: string;
  ncdetQTY?: number | string | null;
  ncdetPrice?: number | string | null;
  ncdetDiscount?: number | string | null;
  ncdetVATAmount?: number | string | null;
  ncdetNetAmount?: number | string | null;
  item?: { itmCode?: string | null; itmName?: string | null } | null;
}
export interface NcRecord {
  id: string;
  ncmstrCode?: string | null;
  ncmstrDate?: string | null;
  ncmstrName?: string | null;
  ncmstrContactNo?: string | null;
  ncmstrReference?: string | null;
  details?: NcDetail[];
}

// Map the UI's SaleItem shape onto the backend Create/Update NcAdjustmentDto and
// drop display-only / unsupported fields (itemCode, itemName, root netAmount) so
// the strict whitelist + forbidNonWhitelisted ValidationPipe doesn't 400.
const toPayload = (data: NcPayload) => ({
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
});

export const createNcAdjustment = (data: NcPayload) =>
  api.post("/nc-adjustment", toPayload(data)).then((r) => r.data);

export const fetchNcAdjustment = (id: string) =>
  api.get<NcRecord>(`/nc-adjustment/${id}`).then((r) => r.data);

export const updateNcAdjustment = (id: string, data: NcPayload) =>
  api.patch(`/nc-adjustment/${id}`, toPayload(data)).then((r) => r.data);
