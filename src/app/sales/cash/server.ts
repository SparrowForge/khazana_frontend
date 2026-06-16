import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface CashSalePayload {
  invoiceNo?: string;
  invoiceDate: string;
  paymentMethod: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  netAmount: number;
  paidAmount: number;
  changeAmount: number;
  discountRemarks?: string;
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const createCashSale = (data: CashSalePayload) =>
  api.post("/sales/cash", data).then((r) => r.data);
