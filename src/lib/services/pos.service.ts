import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

// Payment modes offered at the counter (persisted as a sale's `salesType` /
// t_SOMstr.mtype). Shared by the POS terminal and the sale-edit screen.
export const POS_PAY_MODES = [
  "Cash", "Card", "Bkash", "Rocket", "Nagad",
  "Ucash", "Mycash", "T-cash", "Sure Cash", "Others",
] as const;

// Items come from Item_Information + t_Price (active, date-ranged)
export interface PosProduct {
  id: string;          // Item_Information.id (UUID)
  itmCode: string;     // Item_Information.itmCode
  name: string;        // Item_Information.itmName
  uom: string;         // Item_Information.itmUOM
  price: number;       // t_Price.priceListPrice
  vatPercentage: number; // t_Price.priceVatPercent
  stock: number;       // on-hand quantity (summed Inventory rows)
  imageUrl?: string | null;
}

export interface PosSaleItem {
  id: string;
  itemId: string;
  productName: string;
  /** Catalogue code — printed beside the name on the A4 invoice. */
  itemCode?: string;
  /** Unit of measure — printed beside the quantity on the A4 challan. */
  uom?: string;
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
  bankId?: string | null;
  bankName?: string | null;
  guestName?: string | null;
  discountRemarks?: string | null;
  discountContact?: string | null;
  modifyRemarks?: string | null;
  totalAmount: number;
  discountAmount: number;
  vatAmount: number;
  payableAmount: number;
  paidAmount: number;
  changeAmount: number;
  servedBy: string;
  items: PosSaleItem[];
  /** Branch header for the printed invoice (present on GET /pos/sales/:id). */
  branch?: { name: string; address: string; vatNo: string; mobileNo: string } | null;
}

export interface CreatePosSalePayload {
  items: { itemId: string; qty: number }[];
  paidAmount: number;
  servedBy?: string;
  salesType?: string;
  /** Bank UUID — set when salesType is 'Card'. */
  bankId?: string;
  /** Session branch UUID. */
  branchId?: string;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
  /** Discount authoriser name/contact — sent when a discount is applied. */
  discountRemarks?: string;
  discountContact?: string;
  /** Walk-in customer's name → SoMstr_GuestName. Optional on every sale and
   *  independent of the discount authoriser above; Sales History Summary shows
   *  it in place of 'POS'. Not printed on the receipt. */
  guestName?: string;
  /** Mandatory reason for an edit (update only) → SoMstr_ModifyRemarks. */
  modifyRemarks?: string;
}

// ── Offline sync ──────────────────────────────────────────────
export interface OfflineSalePayload {
  invoiceNo: string;
  items: { itemId: string; qty: number }[];
  paidAmount: number;
  clientSavedAt: string;
  servedBy?: string;
  salesType?: string;
  /** Bank UUID — set when salesType is 'Card'. */
  bankId?: string;
  /** Originating branch UUID captured at sale time. */
  branchId?: string;
  discountType?: "fixed" | "percentage";
  discountValue?: number;
  /** Discount authoriser name/contact — captured when a discount is applied. */
  discountRemarks?: string;
  discountContact?: string;
  /** Walk-in customer's name → SoMstr_GuestName. */
  guestName?: string;
}

export interface SyncOfflinePayload {
  userId: string;
  userName: string;
  orders: OfflineSalePayload[];
}

export interface SyncOrderResult {
  invoiceNo: string;
  status: "synced" | "skipped" | "failed";
  saleId?: string;
  reason?: string;
}

export interface SyncOfflineResult {
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  results: SyncOrderResult[];
}

export const posProductsApi = {
  getAll: () => api.get<PosProduct[]>("/pos/products").then((r) => r.data),
};

// Banks for the Card-payment dropdown (sourced from the Bank table via the
// admin banks endpoint). Returns a flat {id,name} list, unwrapping the
// paginated envelope when present.
export interface PosBank { id: string; name: string }
export const posBanksApi = {
  getAll: () =>
    api.get("/admin/banks?page=1&limit=100").then((r) => {
      const rows = unwrapList<{ id: string; name?: string }>(r);
      return rows.map((b) => ({ id: b.id, name: b.name ?? "" }));
    }),
};

export const posSalesApi = {
  create: (data: CreatePosSalePayload) =>
    api.post<PosSale>("/pos/sales", data).then((r) => r.data),
  /** Optionally scoped to an inclusive date range (YYYY-MM-DD). */
  getAll: (params: { fromDate?: string; toDate?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.fromDate) q.append("fromDate", params.fromDate);
    if (params.toDate) q.append("toDate", params.toDate);
    const qs = q.toString();
    return api.get<PosSale[]>(`/pos/sales${qs ? `?${qs}` : ""}`).then((r) => r.data);
  },
  getOne: (id: string) => api.get<PosSale>(`/pos/sales/${id}`).then((r) => r.data),
  update: (id: string, data: CreatePosSalePayload) =>
    api.patch<PosSale>(`/pos/sales/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/pos/sales/${id}`).then((r) => r.data),
  syncOffline: (data: SyncOfflinePayload) =>
    api.post<SyncOfflineResult>("/pos/sync-offline", data).then((r) => r.data),
};
