import api from "@/lib/api";
import { unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";

export interface Order {
  id: number;
  serialNo?: string;
  clientCode?: string;
  orderDate?: string;
  deliveryDate?: string;
  totalPrice?: number;
  isActive?: number;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
}

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
}

export interface OrderPayload {
  clientCode: string;
  orderDate: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  advance?: number;
  discount?: number;
  totalPrice: number;
  items: { itemCode: string; qty: number; unitPrice: number }[];
}

export const fetchOrders = ({ page = 1, limit = 10 } = {}): Promise<Paginated<Order>> =>
  api.get(`/orders?page=${page}&limit=${limit}`).then(unwrapPaginated<Order>);

export const createOrder = (data: OrderPayload) =>
  api.post<Order>("/orders", data).then((r) => r.data);

export const fetchCustomers = (): Promise<Customer[]> =>
  api.get("/customers?limit=100").then(unwrapList<Customer>);

export const fetchItems = (): Promise<AvailableItem[]> =>
  api.get("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);
