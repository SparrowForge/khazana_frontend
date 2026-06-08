import api from "@/lib/api";

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

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchOrders = () =>
  api.get<{ data: Order[] } | Order[]>("/orders").then(unwrap<Order[]>);

export const createOrder = (data: OrderPayload) =>
  api.post<Order>("/orders", data).then((r) => r.data);

export const fetchCustomers = () =>
  api.get<{ data: Customer[] } | Customer[]>("/customers?limit=500").then(unwrap<Customer[]>);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=500").then(unwrap<AvailableItem[]>);
