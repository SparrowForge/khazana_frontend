import api from "@/lib/api";

export interface Order {
  id: number;
  serialNo?: string;
  clientCode?: string;
  orderDate?: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  advance?: number;
  discount?: number;
  totalPrice?: number;
  isActive?: number;
}

export interface OrderLine {
  itemCode: string;
  qty: number;
  unitPrice: number;
}

export interface OrderPayload {
  clientCode: string;
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

const unwrap = <T>(res: { data: { data?: T } | T }): T =>
  (res.data as { data?: T }).data ?? (res.data as T);

export const ordersService = {
  list: () =>
    api.get<{ data: Order[] } | Order[]>("/orders").then(unwrap<Order[]>),

  create: (data: OrderPayload) =>
    api.post<Order>("/orders", data).then((r) => r.data),

  listVat: () =>
    api.get<{ data: VatOrder[] } | VatOrder[]>("/orders/vat").then(unwrap<VatOrder[]>),
};
