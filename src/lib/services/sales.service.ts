import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { SaleItem } from "@/types";

export interface Sale {
  id: number;
  invNo?: string;
  date?: string;
  customerName?: string;
  totalAmount?: number;
  discount?: number;
  netAmount?: number;
  saleType?: string;
}

export interface CashSalePayload {
  invoiceNo: string;
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

export interface CreditSalePayload {
  invoiceNo: string;
  invoiceDate: string;
  clientCode: string;
  poNo?: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  netAmount: number;
}

export interface VatCashSalePayload {
  invoiceNo: string;
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

export interface VatCreditSalePayload {
  invoiceNo: string;
  invoiceDate: string;
  clientCode: string;
  vatClnNo?: string;
  items: SaleItem[];
  totalAmount: number;
  totalDiscount: number;
  totalVat: number;
  netAmount: number;
}


export const salesService = {
  list: () =>
    api.get<{ data: Sale[] } | Sale[]>("/sales").then(unwrapList<Sale>),

  createCash: (data: CashSalePayload) =>
    api.post("/sales/cash", data).then((r) => r.data),

  createCredit: (data: CreditSalePayload) =>
    api.post("/sales/credit", data).then((r) => r.data),

  createVatCash: (data: VatCashSalePayload) =>
    api.post("/sales/vat/cash", data).then((r) => r.data),

  createVatCredit: (data: VatCreditSalePayload) =>
    api.post("/sales/vat/credit", data).then((r) => r.data),
};
