import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Order {
  id: number;
  serialNo?: string;
  clientId?: string;
  orderDate?: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  advance?: number;
  discount?: number;
  totalPrice?: number;
  isActive?: number;
  branchId?: string;
  createBy?: string;
  /** Derived server-side: "Delivery Done" once a credit sale carries this
   *  order's serialNo as its PO No, "Delivery Pending" otherwise. */
  deliveryStatus?: string;
}

export interface BranchInfo {
  id: string;
  branchName?: string;
  address?: string;
  vatNo?: string;
  mobileNo?: string;
}

export interface OrderDetail {
  id: string;
  itemId: string;
  qty: number;
  unitPrice?: number;
}

export interface OrderRecord extends Order {
  details?: OrderDetail[];
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  address?: string;
}

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
  vatPercentage?: number;
}

export interface OrderPayload {
  clientId: string;
  orderDate: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  advance?: number;
  discount?: number;
  totalPrice: number;
  items: { itemId: string; qty: number; unitPrice: number }[];
}

export const fetchOrders = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Order>> =>
  api.get(`/orders?page=${page}&limit=${limit}`).then(unwrapPaginated<Order>);

export const fetchOrder = (id: number | string): Promise<OrderRecord> =>
  api.get(`/orders/${id}`).then((r) => r.data);

export const createOrder = (data: OrderPayload) =>
  api.post<Order>("/orders", data).then((r) => r.data);

export const updateOrder = (id: number | string, data: OrderPayload) =>
  api.patch<Order>(`/orders/${id}`, data).then((r) => r.data);

export const deleteOrder = (id: number | string) =>
  api.delete(`/orders/${id}`).then((r) => r.data);

export const fetchCustomers = (): Promise<Customer[]> =>
  api.get("/customers?limit=100").then(unwrapList<Customer>);

export const fetchItems = (): Promise<AvailableItem[]> =>
  api.get("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

/** Every item, for the entry screens that list the whole catalogue in a grid
 *  (Demand Order) rather than a per-line picker.
 *
 *  Separate from `fetchItems` on purpose: that one is shared by the other order
 *  screens, whose pickers should keep showing only active items. Pages at 100
 *  because `PaginationQueryDto` caps `limit`, and skips the `isActive` filter
 *  because the backend matches that column as an exact string — anything stored
 *  as null, lowercase or 'N' would silently vanish from the sheet. */
export const fetchAllItems = async (): Promise<AvailableItem[]> => {
  const PAGE_SIZE = 100;
  const all: AvailableItem[] = [];
  for (let page = 1; ; page++) {
    const batch = await api
      .get(`/inventory/items?page=${page}&limit=${PAGE_SIZE}`)
      .then(unwrapList<AvailableItem>);
    all.push(...batch);
    // A short page is the last one; the guard stops a malformed response from
    // looping forever.
    if (batch.length < PAGE_SIZE || page >= 50) break;
  }
  return all;
};

export const fetchBranches = (): Promise<BranchInfo[]> =>
  api.get("/admin/branches?limit=100").then(unwrapList<BranchInfo>);
