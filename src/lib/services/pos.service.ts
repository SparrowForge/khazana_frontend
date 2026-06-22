import api from "@/lib/api";

// Items come from Item_Information + t_Price (active, date-ranged)
export interface PosProduct {
  id: string;          // Item_Information.id (UUID)
  itmCode: string;     // Item_Information.itmCode
  name: string;        // Item_Information.itmName
  uom: string;         // Item_Information.itmUOM
  price: number;       // t_Price.priceListPrice
  vatPercentage: number; // t_Price.priceVatPercent
  imageUrl?: string | null;
}

export interface PosSaleItem {
  id: string;
  productName: string;
  qty: number;
  rate: number;
  vatPct: number;
  vat: number;
  total: number;
}

export interface PosSale {
  id: string;
  invoiceNo: string;
  dateTime: string;
  salesType: string;
  totalAmount: number;
  vatAmount: number;
  payableAmount: number;
  paidAmount: number;
  changeAmount: number;
  servedBy: string;
  items: PosSaleItem[];
}

export interface CreatePosSalePayload {
  items: { itemId: string; qty: number }[];
  paidAmount: number;
  servedBy?: string;
  salesType?: string;
  branchId?: number;
}

export const posProductsApi = {
  getAll: () => api.get<PosProduct[]>("/pos/products").then((r) => r.data),
};

export const posSalesApi = {
  create: (data: CreatePosSalePayload) =>
    api.post<PosSale>("/pos/sales", data).then((r) => r.data),
  getAll: () => api.get<PosSale[]>("/pos/sales").then((r) => r.data),
  getOne: (id: string) => api.get<PosSale>(`/pos/sales/${id}`).then((r) => r.data),
};
