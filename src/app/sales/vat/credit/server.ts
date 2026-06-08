import api from "@/lib/api";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface VatCreditSalePayload {
  invoiceNo?: string;
  invoiceDate: string;
  clientCode: string;
  vatClnNo?: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  netAmount: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=500").then(unwrap<AvailableItem[]>);

export const fetchCustomers = () =>
  api.get<{ data: { id: number; code: string; name: string }[] } | { id: number; code: string; name: string }[]>("/customers?limit=500")
    .then(unwrap<{ id: number; code: string; name: string }[]>);

export const createVatCreditSale = (data: VatCreditSalePayload) =>
  api.post("/sales/vat/credit", data).then((r) => r.data);
