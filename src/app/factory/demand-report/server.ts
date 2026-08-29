import api from "@/lib/api";

/** One item row: the demanded qty per branch, keyed by branch id. */
export interface DemandReportRow {
  sl: number;
  itemCode: string;
  itemName: string;
  uom: string;
  /** VAT-INCLUSIVE unit rate, as the printed sheet shows it (1,800 not 1,636.36). */
  rate: number;
  /** Branch id → qty. A branch that demanded nothing is absent, not 0, so the
   *  sheet prints blanks the way the paper form does. */
  qtyByBranch: Record<string, number>;
  totalQty: number;
  amount: number;
}

export interface DemandReportBranch {
  id: string;
  code: string;
  name: string;
}

export interface DemandReport {
  fromDate: string;
  toDate: string;
  company: { name: string; address: string };
  /** Who the demand was raised ON — the factory, normally the session branch. */
  toBranch: { id: string; code: string; name: string };
  /** Who raised it; `All Branches` when no single branch was picked. */
  fromBranch: { id: string; name: string };
  /** One table column each, in branch-code order. */
  branches: DemandReportBranch[];
  items: DemandReportRow[];
  totals: { qtyByBranch: Record<string, number>; totalQty: number; amount: number };
}

/** Factory-only — the backend 403s unless the session branch is the factory.
 *  `fromBranchId` omitted means every demanding branch gets its own column. */
export const fetchDemandReport = (
  fromDate: string,
  toDate: string,
  fromBranchId?: string,
  toBranchId?: string,
  /** 'First' | 'Second' | 'Special'. Omitted = every round. Historical orders
   *  were back-filled as 'First', so a filtered run covers the full history. */
  orderType?: string,
) =>
  api
    .get<DemandReport>(
      `/reports/demand?fromDate=${fromDate}&toDate=${toDate}` +
        `${fromBranchId ? `&fromBranchId=${fromBranchId}` : ""}` +
        `${toBranchId ? `&toBranchId=${toBranchId}` : ""}` +
        `${orderType ? `&orderType=${orderType}` : ""}`,
    )
    .then((r) => r.data);

/** Params a Demand Report run is generated from — what a share link stores and
 *  replays, so the link always shows current data rather than a snapshot. */
export interface DemandReportParams {
  fromDate: string;
  toDate: string;
  fromBranchId?: string;
  toBranchId?: string;
  orderType?: string;
}

/**
 * Creates the public link for a generated report.
 *
 * Anyone holding it can read the sheet — no login, no expiry, no revocation.
 * The token is a UUID: 122 bits, so it cannot be guessed or walked, but it
 * cannot be taken back once sent either. Treat the URL itself as the secret.
 *
 * The server re-runs the report when the link is opened, and refuses to mint a
 * token for a query it cannot run — so a broken link is caught here, by the
 * person sharing, rather than by whoever they sent it to.
 */
export const createDemandReportShare = (params: DemandReportParams): Promise<{ token: string }> =>
  api.post<{ token: string }>("/report-shares", { reportKey: "demand", params }).then((r) => r.data);

/** The report behind a share token. No login required. */
export const fetchSharedDemandReport = (token: string): Promise<DemandReport> =>
  api
    .get<{ reportKey: string; data: DemandReport }>(`/report-shares/public/${token}`)
    .then((r) => r.data.data);

/** The link to hand out. See `createDemandReportShare` for what it exposes. */
export const demandReportShareUrl = (token: string) =>
  typeof window === "undefined" ? "" : `${window.location.origin}/report/demand/${token}`;
