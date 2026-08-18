import api from "@/lib/api";

/** One item's row. Every column is a Qty/Tk pair; Tk is Qty × the VAT-inclusive
 *  list rate, except `salesTk` (the actual net sale amount) and `productionTk`
 *  (valued at the rate recorded on each Production entry). */
export interface ProductionDeliveryRow {
  sl: number;
  itemCode: string;
  itemName: string;
  uom: string;
  rate: number;
  openingQty: number; openingTk: number;
  productionQty: number; productionTk: number;
  returnQty: number; returnTk: number;
  totalStockQty: number; totalStockTk: number;
  salesQty: number; salesTk: number;
  rejectQty: number; rejectTk: number;
  shortQty: number; shortTk: number;
  overQty: number; overTk: number;
  deliveryQty: number; deliveryTk: number;
  closingQty: number; closingTk: number;
}

export type ProductionDeliveryTotals = Omit<
  ProductionDeliveryRow,
  "sl" | "itemCode" | "itemName" | "uom" | "rate"
>;

export interface ProductionDeliveryReport {
  fromDate: string;
  toDate: string;
  company: { name: string; address: string };
  branch: { name: string; address: string; vatNo: string };
  items: ProductionDeliveryRow[];
  totals: ProductionDeliveryTotals;
}

/** Factory-only: the backend scopes the report to the session branch and 403s
 *  if that branch isn't the factory, so there is no branchId parameter. */
export const fetchProductionDelivery = (fromDate: string, toDate: string) =>
  api
    .get<ProductionDeliveryReport>(`/reports/production-delivery?fromDate=${fromDate}&toDate=${toDate}`)
    .then((r) => r.data);
