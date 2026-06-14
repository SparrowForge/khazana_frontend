import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface VatOrder {
  id: number;
  serialNo?: string;
  clientCode?: string;
  orderDate?: string;
  deliveryDate?: string;
}


export const fetchVatOrders = () =>
  api.get<{ data: VatOrder[] } | VatOrder[]>("/orders/vat/list").then(unwrapList<VatOrder>);
