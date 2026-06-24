import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: string;
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


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const createVatCashSale = (data: VatCashSalePayload) =>
  api.post("/sales/vat/cash", data).then((r) => r.data);
