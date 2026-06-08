import api from "@/lib/api";

export interface VatOrder {
  id: number;
  serialNo?: string;
  clientCode?: string;
  orderDate?: string;
  deliveryDate?: string;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchVatOrders = () =>
  api.get<{ data: VatOrder[] } | VatOrder[]>("/orders/vat/list").then(unwrap<VatOrder[]>);
