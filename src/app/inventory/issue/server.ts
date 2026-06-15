import api from "@/lib/api";
import { unwrapList } from "@/lib/unwrap";

export interface AvailableItem {
  id: number;
  itmCode: string;
  itmName?: string;
}

export interface IssuePayload {
  voucherNo?: string;
  issueDate: string;
  items: { itemCode: string; qty: number; unitPrice: number }[];
}


export const fetchItems = () =>
  api.get<{ data: AvailableItem[] } | AvailableItem[]>("/inventory/items?limit=100").then(unwrapList<AvailableItem>);

export const issueStock = (data: IssuePayload) =>
  api.post("/inventory/issue", data).then((r) => r.data);
