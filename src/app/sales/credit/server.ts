import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface CreditSalePayload {
  invoiceNo?: string;
  invoiceDate: string;
  clientCode: string;
  poNo?: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  netAmount: number;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=500").then(unwrapList<AvailableItem>);

export const fetchCustomers = () =>
  api.get<{ data: { id: number; code: string; name: string }[] } | { id: number; code: string; name: string }[]>("/customers?limit=500")
    .then(unwrapList<{ id: number; code: string; name: string }>);

export const createCreditSale = (data: CreditSalePayload) =>
  api.post("/sales/credit", data).then((r) => r.data);
