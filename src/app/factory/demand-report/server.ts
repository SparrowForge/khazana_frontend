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
  /** 'First' | 'Second' | 'Special'. Omitted = every round. Orders raised before
   *  the field existed carry no type, so they drop out of a filtered run. */
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
