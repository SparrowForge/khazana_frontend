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

export const fetchBranches = (): Promise<BranchInfo[]> =>
  api.get("/admin/branches?limit=100").then(unwrapList<BranchInfo>);
