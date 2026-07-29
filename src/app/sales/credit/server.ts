import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
  vatPercentage?: number;
}

/** Customer options for the invoice header. `mobile`/`address` back the contact
 *  line shown once a customer is picked, and the corporate invoice's Bill To. */
export interface CreditCustomer {
  id: string;
  code: string;
  name: string;
  mobile?: string;
  address?: string;
}

/** Order options for the PO No picker — a credit sale is raised against an
 *  order by storing that order's serialNo in CSMaster.PONo. Decimal columns
 *  arrive as strings, hence the `number | string` money fields. */
export interface OrderOption {
  id: string;
  serialNo?: string;
  orderDate?: string;
  advance?: number | string;
  totalPrice?: number | string;
  clientId?: string;
  deliveryStatus?: string;
}

/** A line of an order, as returned by GET /orders/:id. `item` is the joined
 *  Item_Information summary, so a line can be named without the catalog. */
export interface OrderLine {
  id: string;
  itemId?: string;
  qty: number | string;
  unitPrice?: number | string;
  item?: { id: string; itmCode: string; itmName?: string | null };
}

export interface OrderRecord extends OrderOption {
  details?: OrderLine[];
}

export interface CreditSalePayload {
  invoiceNo?: string;
  invoiceDate: string;
  customerId: string;
  poNo?: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  netAmount: number;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchCustomers = () =>
  api.get<{ data: CreditCustomer[] } | CreditCustomer[]>("/customers?limit=100")
    .then(unwrapList<CreditCustomer>);

/** Orders offered in the PO picker, always scoped to the invoice's customer.
 *  Only orders that haven't been billed yet are listed — an order whose number
 *  already sits on a credit sale is "Delivery Done" and must not be billed
 *  twice. Returns nothing without a customer, so the picker can't be used
 *  before one is chosen. */
export const fetchOrdersForCustomer = (clientId: string) => {
  if (!clientId) return Promise.resolve([] as OrderOption[]);
  const qs = new URLSearchParams({ limit: "100", clientId, deliveryStatus: "pending" });
  return api.get<{ data: OrderOption[] } | OrderOption[]>(`/orders?${qs}`).then(unwrapList<OrderOption>);
};

/** One order with its detail lines — the source for prefilling the invoice
 *  items when a PO is picked. */
export const fetchOrder = (id: string) =>
  api.get<OrderRecord>(`/orders/${id}`).then((r) => r.data);

/** POST /sales/credit responds with the created row (some routes wrap it in
 *  `{ data }`) — we only need the id, to jump straight to its invoice. */
interface CreatedCreditSale {
  id?: string;
  data?: { id?: string };
}

export const createCreditSale = (data: CreditSalePayload) => {
  // Map the UI's SaleItem/payload shape onto CreateCreditSaleDto and drop
  // display-only / unsupported fields so the strict ValidationPipe doesn't 400.
  // Credit items are keyed by itemId (the Item_Information UUID, stored in
  // CSDetail.itemOId — a uuid FK) and use qty/disc.
  const payload = {
    invNo: data.invoiceNo || undefined, // blank → backend auto-generates
    invDate: data.invoiceDate,
    customerId: data.customerId,
    poNo: data.poNo || undefined,
    totalAmount: data.totalAmount,
    totalDiscount: data.totalDiscount,
    totalVat: data.totalVat,
    items: data.items.map((it) => ({
      itemId: it.itemId,
      qty: it.quantity,
      rate: it.rate,
      disc: it.discount,
      vat: it.vat,
      total: it.total,
    })),
  };
  return api.post<CreatedCreditSale>("/sales/credit", payload).then((r) => r.data);
};
