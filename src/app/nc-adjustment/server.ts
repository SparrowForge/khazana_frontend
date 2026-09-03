import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";
import { emitStockChanged } from "@/lib/stockEvents";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
  vatPercentage?: number;
  /** On-hand qty from Inventory. An NC hands the goods over without charging
   *  for them, so it deducts stock like a sale and can't over-issue. */
  stock?: number;
}

/** A customer offered in the NC recipient picker. An NC hands goods over
 *  without charging for them, so the recipient is the whole audit trail — it is
 *  a registered customer now, not free text typed per document. */
export interface NcCustomer {
  id: string;
  code: string;
  name: string;
  mobile?: string;
  address?: string;
}

export interface NcPayload {
  code?: string;
  date: string;
  /** Required — the backend rejects a missing customer or a blank reference. */
  customerId: string;
  reference: string;
  items: SaleItem[];
  netAmount: number;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchCustomers = () =>
  api.get<{ data: NcCustomer[] } | NcCustomer[]>("/customers?limit=100").then(unwrapList<NcCustomer>);

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
  customerId?: string | null;
  customer?: { id: string; code?: string | null; name?: string | null; mobile?: string | null } | null;
  /** Legacy free-text recipient, only on NCs entered before the customer link
   *  existed. Shown, never written. */
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
  // Sent verbatim (not `|| undefined`) — these are mandatory server-side.
  customerId: data.customerId,
  reference: data.reference.trim(),
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
  api.post("/nc-adjustment", toPayload(data)).then((r) => { emitStockChanged("nc:create"); return r.data; });

export const fetchNcAdjustment = (id: string) =>
  api.get<NcRecord>(`/nc-adjustment/${id}`).then((r) => r.data);

export const updateNcAdjustment = (id: string, data: NcPayload) =>
  api.patch(`/nc-adjustment/${id}`, toPayload(data)).then((r) => { emitStockChanged("nc:update"); return r.data; });
