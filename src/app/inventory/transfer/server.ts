import api from "@/lib/api";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
}

export interface BranchOption {
  id: number;
  branchName: string;
}

export interface TransferPayload {
  voucherNo?: string;
  issueDate: string;
  issueBranchId: number;
  receiveBranchId: number;
  items: { itemCode: string; qty: number }[];
}

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=500").then(unwrap<AvailableItem[]>);

export const fetchBranches = () =>
  api.get<{ data: BranchOption[] } | BranchOption[]>("/admin/branches").then(unwrap<BranchOption[]>);

export const transferStock = (data: TransferPayload) =>
  api.post("/inventory/transfer", data).then((r) => r.data);
