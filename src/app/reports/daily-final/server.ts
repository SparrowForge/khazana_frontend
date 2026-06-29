import api from "@/lib/api";

export interface CategoryRow {
  kg: number;
  pcs: number;
  amount: number;
}

export interface NamedAmount {
  name: string;
  contact: string;
  amount: number;
}

export interface DiscountRow extends NamedAmount {
  detail: string;
}

export interface CardBankRow {
  bank: string;
  amount: number;
}

export interface CorrectionRow {
  invNo: string;
  name: string;
  chgAmt: number;
}

export interface HourRow {
  hour: number;
  label: string;
  qty: number;
  amount: number;
}

export interface DailyFinalReport {
  date: string;
  branch: { name: string; address: string; vatNo: string };
  categories: {
    regular: CategoryRow;
    assorted: CategoryRow;
    issue: CategoryRow;
    credit: CategoryRow;
  };
  payments: { bkash: number; card: number; cash: number; credit: number };
  totals: { totalSale: number; ncSale: number; discount: number; grandTotal: number };
  breakdown: { credit: NamedAmount[]; discount: DiscountRow[]; nc: NamedAmount[] };
  cardBank: CardBankRow[];
  salesCorrection: CorrectionRow[];
  hourwise: HourRow[];
}

export const fetchDailyFinalReport = (date: string, branchId: string) =>
  api
    .get<DailyFinalReport>(`/reports/daily-final?date=${date}&branchId=${branchId}`)
    .then((r) => r.data);
