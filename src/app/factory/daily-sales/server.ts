import api from "@/lib/api";

/** One branch's block on the report. */
export interface DailySalesBranchRow {
  id: string;
  /** Branch code — what the printed report and the WhatsApp text label the block with. */
  code: string;
  name: string;
  /** Factory rows are kept out of "Total Outlet Sales" and added on separately. */
  isFactory: boolean;
  /** Everything the branch sold: counter + VAT counter + credit + VAT credit,
   *  VAT-inclusive and net of discount. */
  sale: number;
  invoiceCount: number;
  /** The Food Panda / Foodi slice OF `sale` — already inside it, never an
   *  addition to it. */
  onlineSale: number;
  onlineInvoiceCount: number;
}

export interface DailySalesReport {
  fromDate: string;
  toDate: string;
  company: { name: string; address: string };
  /** The branch this run was filtered to, or `All Branches`. */
  branch: { id: string; name: string };
  branches: DailySalesBranchRow[];
  totals: {
    outletSales: number;
    outletInvoices: number;
    /** Memo line — this money is already counted inside the branch figures. */
    onlineSales: number;
    onlineInvoices: number;
    factorySales: number;
    factoryInvoices: number;
    /** Outlets + factory. Online is NOT added again. */
    totalSales: number;
    /** Same basis, from the 1st of the end date's month through `toDate`. */
    mtdSales: number;
  };
}

/** Factory-only — the backend 403s unless the session branch is the factory.
 *  `branchId` omitted means every branch. */
export const fetchDailySales = (fromDate: string, toDate: string, branchId?: string) =>
  api
    .get<DailySalesReport>(
      `/reports/daily-sales?fromDate=${fromDate}&toDate=${toDate}` +
        `${branchId ? `&branchId=${branchId}` : ""}`,
    )
    .then((r) => r.data);
