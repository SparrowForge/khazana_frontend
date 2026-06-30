import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  price?: number;
}

export interface CreditCustomer {
  id: string;
  code: string;
  name: string;
}

/** Shape returned by GET /sales/credit/:id (already mapped to the UI's SaleItem). */
export interface CreditSaleRecord {
  id: string;
  invoiceNo: string;
  invoiceDate: string | null;
  customerId: string | null;
  customerName: string | null;
  poNo: string | null;
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  items: SaleItem[];
}

export interface UpdateCreditSalePayload {
  invoiceDate: string;
  customerId: string;
  poNo?: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
}

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchCustomers = () =>
  api.get<{ data: CreditCustomer[] } | CreditCustomer[]>("/customers?limit=100").then(unwrapList<CreditCustomer>);

export const fetchCreditSale = (id: string) =>
  api.get<CreditSaleRecord>(`/sales/credit/${id}`).then((r) => r.data);

export const updateCreditSale = (id: string, data: UpdateCreditSalePayload) => {
  // Map the UI's SaleItem shape onto UpdateSalesDto. Credit lines are keyed by
  // itemId (the Item_Information UUID, stored in CSDetail.itemOId) and use
  // qty/discount; drop display-only fields so the strict ValidationPipe won't 400.
  const payload = {
    invoiceDate: data.invoiceDate,
    customerId: data.customerId,
    poNo: data.poNo || undefined,
    totalAmount: data.totalAmount,
    totalDiscount: data.totalDiscount,
    totalVat: data.totalVat,
    items: data.items.map((it) => ({
      itemId: it.itemId,
      qty: it.quantity,
      rate: it.rate,
      discount: it.discount,
      vat: it.vat,
      total: it.total,
    })),
  };
  return api.patch(`/sales/credit/${id}`, payload).then((r) => r.data);
};
