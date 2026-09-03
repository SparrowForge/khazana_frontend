import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";
import { emitStockChanged } from "@/lib/stockEvents";

// Payment modes offered at the counter (persisted as a sale's `salesType` /
// t_SOMstr.mtype). Shared by the POS terminal and the sale-edit screen.
export const POS_PAY_MODES = [
  "Cash", "Card", "Bkash", "Rocket", "Nagad",
  "Ucash", "Mycash", "T-cash", "Sure Cash", "Others",
] as const;

/** The mode a bill carries when it was settled more than one way. Deliberately
 *  NOT in POS_PAY_MODES: that list is the tenders a split is built from, and
 *  "Multiple" is not something a single split row can be. The real breakdown
 *  lives in the sale's `payments`. */
export const MULTI_PAY_MODE = "Multiple";

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
  /** Item_Information.IsDiscountApplicable — false puts the item outside the
   *  sale's discount: billed in full, and its value left out of the base the
   *  discount is charged on. The server applies the same rule. */
  isDiscountApplicable?: boolean;
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
  /** The customer this sale was billed to. All four null is a walk-in — the
   *  default at the till, and the only case with no customer behind the sale. */
  customerId?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  /** Last 4 digits of the card, on a Card sale only. */
  cardNo?: string | null;
  discountRemarks?: string | null;
  discountContact?: string | null;
  modifyRemarks?: string | null;
  totalAmount: number;
  discountAmount: number;
  vatAmount: number;
  payableAmount: number;
  paidAmount: number;
  changeAmount: number;
  /** What the tenders settled, and what is still owed. A sale raised before
   *  split payments reads back as fully paid — which it was. */
  settledAmount?: number;
  dueAmount?: number;
  paymentStatus?: string;
  /** The tender breakdown. EMPTY on a sale raised before split payments — use
   *  `salesType` for those. */
  payments?: { id: string; method: string; amount: number; bankId?: string | null; bankName?: string | null; cardNo?: string | null; transactionRef?: string | null }[];
  /** The cashier who rang the sale — stamped server-side from their session,
   *  never sent by the terminal. */
  servedBy: string;
  items: PosSaleItem[];
  /** Branch header for the printed invoice (present on GET /pos/sales/:id). */
  branch?: { name: string; address: string; vatNo: string; mobileNo: string } | null;
}


/** One tender against a bill — several of these are a payment split. Amounts are
 *  what each tender puts AGAINST the bill and must add up to the payable. */
export interface SalePaymentPayload {
  method: string;
  amount: number;
  bankId?: string;
  cardNo?: string;
  transactionRef?: string;
}

export interface CreatePosSalePayload {
  items: { itemId: string; qty: number }[];
  paidAmount: number;
  salesType?: string;
  /** Bank UUID — set when salesType is 'Card'. */
  bankId?: string;
  /** Session branch UUID. */
  branchId?: string;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
  /** Customer UUID this sale is billed to. Omitted for a walk-in, which is the
   *  default at the till — but MANDATORY once a discount is applied: the server
   *  rejects a discounted walk-in, and stamps the customer's name and mobile
   *  onto the discount audit the reports read. */
  customerId?: string;
  /** Last 4 digits of the card — sent only when salesType is 'Card'. */
  cardNo?: string;
  /** Mandatory reason for an edit (update only) → SoMstr_ModifyRemarks. */
  modifyRemarks?: string;
  /** Split payment: one entry per tender. Omit for an ordinary single-payment
   *  sale — salesType/bankId/cardNo then describe the one tender, as before. */
  payments?: SalePaymentPayload[];
  /** Accept a split total below the payable and book the rest as due. */
  allowPartial?: boolean;
}

// ── Offline sync ──────────────────────────────────────────────
export interface OfflineSalePayload {
  invoiceNo: string;
  items: { itemId: string; qty: number }[];
  paidAmount: number;
  clientSavedAt: string;
  salesType?: string;
  /** Bank UUID — set when salesType is 'Card'. */
  bankId?: string;
  /** Originating branch UUID captured at sale time. */
  branchId?: string;
  discountType?: "fixed" | "percentage";
  discountValue?: number;
  /** Customer UUID captured at sale time; absent for a walk-in. */
  customerId?: string;
  /** Last 4 digits of the card, captured at sale time. */
  cardNo?: string;
  /** Split payment captured at the till while offline. */
  payments?: SalePaymentPayload[];
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

/**
 * Customers offered by the terminal's picker.
 *
 * The counter bills a walk-in by default, so this list only has to be reachable
 * — not complete on the first keystroke. It is the same `/customers` feed the
 * credit-sale header uses, and the same page-1 cap: a till with more than that
 * many registered customers wants a type-ahead endpoint, not a longer dropdown.
 */
export interface PosCustomer {
  id: string;
  code: string;
  name: string;
  mobile?: string | null;
  /** The counter customer the till defaults to. A discount may not be given to
   *  this one — see the discount guard on the POS screens. */
  isWalkIn?: boolean;
}
export const posCustomersApi = {
  getAll: () =>
    api.get("/customers?page=1&limit=100").then((r) => {
      const rows = unwrapList<{ id: string; code?: string; name?: string; mobile?: string | null; isWalkIn?: boolean }>(r);
      return rows.map((c) => ({
        id: String(c.id),
        code: c.code ?? "",
        name: c.name ?? "",
        mobile: c.mobile ?? null,
        isWalkIn: c.isWalkIn ?? false,
      }));
    }),
};

/* Each of these moves on-hand stock server-side, so it announces itself once
 * the server has confirmed: the terminal that rang the sale, its other tabs,
 * and any open credit-sale form re-read the levels instead of going stale. */
export const posSalesApi = {
  create: (data: CreatePosSalePayload) =>
    api.post<PosSale>("/pos/sales", data)
      .then((r) => { emitStockChanged("pos-sale:create"); return r.data; }),
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
    api.patch<PosSale>(`/pos/sales/${id}`, data)
      .then((r) => { emitStockChanged("pos-sale:update"); return r.data; }),
  remove: (id: string) =>
    api.delete(`/pos/sales/${id}`).then((r) => { emitStockChanged("pos-sale:delete"); return r.data; }),
  syncOffline: (data: SyncOfflinePayload) =>
    // No stock signal here on purpose — the queue is only cleared after this
    // resolves, and a refresh that still saw the queued sales would deduct them
    // twice. useOfflineSync announces the flush once the queue is drained.
    api.post<SyncOfflineResult>("/pos/sync-offline", data).then((r) => r.data),
};
