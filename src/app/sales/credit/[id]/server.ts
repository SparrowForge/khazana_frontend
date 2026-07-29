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

export interface CreditCustomer {
  id: string;
  code: string;
  name: string;
  mobile?: string;
  address?: string;
}

/** Order options for the PO No picker — a credit sale is raised against an
 *  order by storing that order's serialNo in CSMaster.PONo. Decimal columns
 *  arrive as strings, hence the `number | string` money field. */
export interface OrderOption {
  id: string;
  serialNo?: string;
  clientId?: string;
  orderDate?: string;
  totalPrice?: number | string;
}

/** Shape returned by GET /sales/credit/:id (already mapped to the UI's SaleItem). */
export interface CreditSaleRecord {
  id: string;
  invoiceNo: string;
  invoiceDate: string | null;
  customerId: string | null;
  customerName: string | null;
  poNo: string | null;
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  items: SaleItem[];
}

export interface UpdateCreditSalePayload {
  invoiceDate: string;
  customerId: string;
  poNo?: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchCustomers = () =>
  api.get<{ data: CreditCustomer[] } | CreditCustomer[]>("/customers?limit=100").then(unwrapList<CreditCustomer>);

/** Orders offered in the PO picker, scoped to the invoice's customer and to
 *  orders not yet billed. The invoice's own PO won't be in here (its credit
 *  sale is exactly what makes that order "Delivery Done"), so the page keeps
 *  the saved value as an extra option. */
export const fetchOrdersForCustomer = (clientId: string) => {
  if (!clientId) return Promise.resolve([] as OrderOption[]);
  const qs = new URLSearchParams({ limit: "100", clientId, deliveryStatus: "pending" });
  return api.get<{ data: OrderOption[] } | OrderOption[]>(`/orders?${qs}`).then(unwrapList<OrderOption>);
};

export const fetchCreditSale = (id: string) =>
  api.get<CreditSaleRecord>(`/sales/credit/${id}`).then((r) => r.data);

export const updateCreditSale = (id: string, data: UpdateCreditSalePayload) => {
  // Map the UI's SaleItem shape onto UpdateSalesDto. Credit lines are keyed by
  // itemId (the Item_Information UUID, stored in CSDetail.itemOId) and use
  // qty/discount; drop display-only fields so the strict ValidationPipe won't 400.
  const payload = {
    invoiceDate: data.invoiceDate,
    customerId: data.customerId,
    poNo: data.poNo || undefined,
    totalAmount: data.totalAmount,
    totalDiscount: data.totalDiscount,
    totalVat: data.totalVat,
    items: data.items.map((it) => ({
      itemId: it.itemId,
      qty: it.quantity,
      rate: it.rate,
      discount: it.discount,
      vat: it.vat,
      total: it.total,
    })),
  };
  return api.patch(`/sales/credit/${id}`, payload).then((r) => r.data);
};
