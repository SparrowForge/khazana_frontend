import api from "@/lib/api";
import { unwrap, unwrapList, unwrapPaginated, type Paginated } from "@/lib/unwrap";
import { emitStockChanged } from "@/lib/stockEvents";

export interface AvailableItem {
  id: string;
  itmCode: string;
  itmName?: string;
  /** On-hand qty, shown for context only — receiving adds stock, so unlike an
   *  issue there is no ceiling to check against. */
  stock?: number;
}

export interface BranchOption {
  id: string;
  branchName: string;
  /** Street address — the Goods Received Note prints the receiving branch's own
   *  address as its letterhead, not the company's. */
  address?: string;
}

export interface ReceivePayload {
  voucherNo?: string;
  purDate: string;
  fromBranchId?: string;
  items: { itemId: string; qty: number }[];
}

/** One row in the Stock Receive list — one per serial number, qty is the sum
 *  of every item line sharing that serial. */
export interface ReceiveRecord {
  id?: string;
  serialNo: string;
  voucharNo?: string;
  qty?: number;
  purDate?: string;
  branchId?: string;
  receiveBranchID?: string;
}

/** Full receive document for a serial number, with all its item lines. */
export interface ReceiveGroup {
  serialNo: string;
  voucherNo?: string;
  purDate?: string;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  fromBranchId?: string;
  /** `uom` prints in brackets after the item name on the Goods Received Note. */
  items: { itemId: string; itemName?: string; uom?: string; qty: number }[];
}

export interface UpdateReceivePayload {
  voucherNo?: string;
  purDate: string;
  fromBranchId?: string;
  branchId?: string;
  items: { itemId: string; itemName?: string; qty: number }[];
}

/** The entry grid lists the whole catalogue, but the shared pagination DTO caps
 *  `limit` at 100 — so walk the pages until one comes back short rather than
 *  silently showing only the first hundred items.
 *
 *  No `isActive` filter: the backend matches that column as an exact string, so
 *  anything stored as null, lowercase or 'N' would vanish from the grid. Mirrors
 *  the Stock Issue sheet. */
export const fetchItems = async (): Promise<AvailableItem[]> => {
  const PAGE_SIZE = 100;
  const all: AvailableItem[] = [];
  for (let page = 1; ; page++) {
    const batch = await api
      .get<{ data: AvailableItem[] } | AvailableItem[]>(`/inventory/items?page=${page}&limit=${PAGE_SIZE}`)
      .then(unwrapList<AvailableItem>);
    all.push(...batch);
    // A short page is the last one; the guard stops a malformed response (an
    // endpoint that ignores `page`) from looping forever.
    if (batch.length < PAGE_SIZE || page >= 50) break;
  }
  return all;
};

export const fetchBranches = () =>
  api.get<{ data: BranchOption[] } | BranchOption[]>("/admin/branches?limit=100").then(unwrapList<BranchOption>);

export const receiveStock = (data: ReceivePayload) =>
  api.post("/inventory/receive", data).then((r) => { emitStockChanged("receive:create"); return r.data; });

export const fetchReceives = ({ page = 1, limit = 10, fromDate, toDate, branchId }: { page?: number; limit?: number; fromDate?: string; toDate?: string; branchId?: string } = {}): Promise<Paginated<ReceiveRecord>> => {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("limit", String(limit));
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  if (branchId) params.append("branchId", branchId);
  return api.get(`/inventory/receive/history?${params.toString()}`).then(unwrapPaginated<ReceiveRecord>);
};

export const fetchReceive = (serialNo: string): Promise<ReceiveGroup> =>
  api.get(`/inventory/receive/${encodeURIComponent(serialNo)}`).then((r) => r.data);

export const updateReceive = (serialNo: string, data: UpdateReceivePayload) =>
  api.patch(`/inventory/receive/${encodeURIComponent(serialNo)}`, data).then((r) => { emitStockChanged("receive:update"); return r.data; });

export const deleteReceive = (serialNo: string) =>
  api.delete(`/inventory/receive/${encodeURIComponent(serialNo)}`).then((r) => { emitStockChanged("receive:delete"); return r.data; });

// ── Receive confirmation (issue -> receive handshake) ──────────────────

/** One pending issue addressed to this branch, as the list view shows it. */
export interface PendingReceive {
  serialNo: string;
  voucherNo?: string | null;
  issueDate?: string | null;
  issueBranchId: string;
  receiveBranchId: string;
  totalItems: number;
  totalQty: number;
  status: "Pending";
}

/** Read-only detail of one pending issue. Quantities are shown, never edited —
 *  the confirm endpoint takes no body and reads them off the issue itself. */
export interface PendingReceiveDetail {
  serialNo: string;
  voucherNo?: string | null;
  issueDate?: string | null;
  issueBranchId: string;
  receiveBranchId: string;
  status: "Pending" | "Received";
  receivedDate?: string | null;
  receivedBy?: string | null;
  items: { itemId: string; itemName?: string; qty: number; isProduction?: boolean }[];
}

export const fetchPendingReceives = ({ page = 1, limit = 10, fromDate, toDate }: { page?: number; limit?: number; fromDate?: string; toDate?: string } = {}): Promise<Paginated<PendingReceive>> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  return api.get(`/inventory/receive/pending?${params.toString()}`).then(unwrapPaginated<PendingReceive>);
};

export const fetchPendingReceive = (serialNo: string) =>
  api.get<{ data: PendingReceiveDetail } | PendingReceiveDetail>(`/inventory/receive/pending/${serialNo}`).then(unwrap<PendingReceiveDetail>);

/** No payload by design — the server takes the quantities from the issue. */
export const confirmReceive = (serialNo: string) =>
  api.post(`/inventory/receive/confirm/${serialNo}`).then((r) => { emitStockChanged("receive:confirm"); return r.data; });
