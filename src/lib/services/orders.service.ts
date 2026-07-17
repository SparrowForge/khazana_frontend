import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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
}

export interface OrderLine {
  itemId: string;
  qty: number;
  unitPrice: number;
}

export interface OrderPayload {
  clientId: string;
  orderDate: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  advance?: number;
  discount?: number;
  totalPrice: number;
  items: OrderLine[];
}

export interface VatOrder {
  id: number;
  serialNo?: string;
  clientCode?: string;
  orderDate?: string;
  totalPrice?: number;
}


export const ordersService = {
  list: () =>
    api.get<{ data: Order[] } | Order[]>("/orders").then(unwrapList<Order>),

  create: (data: OrderPayload) =>
    api.post<Order>("/orders", data).then((r) => r.data),

  listVat: () =>
    api.get<{ data: VatOrder[] } | VatOrder[]>("/orders/vat").then(unwrapList<VatOrder>),
};
