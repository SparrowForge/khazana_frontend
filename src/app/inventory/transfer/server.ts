import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

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


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100&isActive=Y").then(unwrapList<AvailableItem>);

export const fetchBranches = () =>
  api.get<{ data: BranchOption[] } | BranchOption[]>("/admin/branches").then(unwrapList<BranchOption>);

export const transferStock = (data: TransferPayload) =>
  api.post("/inventory/transfer", data).then((r) => r.data);
