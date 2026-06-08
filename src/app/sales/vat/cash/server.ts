import api from "@/lib/api";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface VatCashSalePayload {
  invoiceNo?: string;
  invoiceDate: string;
  vatClnNo?: string;
  paymentMethod: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  netAmount: number;
  paidAmount: number;
  changeAmount: number;
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/items?limit=500").then(unwrap<AvailableItem[]>);

export const createVatCashSale = (data: VatCashSalePayload) =>
  api.post("/sales/vat/cash", data).then((r) => r.data);
